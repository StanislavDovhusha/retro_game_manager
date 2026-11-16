import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { SettingsStore } from '../../core/state/settings.store';
import { DialogStateService } from '../dialogs/dialog-state.service';
import { DonateService } from '../donate/donate.service';
import { TOUR_STEPS, type TourStep } from './tour.config';

/** The tour starts this long after the settings arrive, when the interface has been laid out. */
const START_DELAY_MS = 800;
/** After a card is chosen the folder panel fills in; the paused tour goes on after this pause. */
const RESUME_DELAY_MS = 600;

/**
 * The start-up tour: which step is shown, and whether it runs at all. It starts by itself on the first start (until it
 * is finished or skipped: `ui.tourDone` in the settings) and again from "Restart tour" in the settings. Steps that need
 * an SD card wait for one: the tour pauses and goes on by itself once a card is chosen. The overlay component draws it.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly dialogs = inject(DialogStateService);
  private readonly donate = inject(DonateService);
  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly steps: readonly TourStep[] = TOUR_STEPS;
  /** The tour runs (it may be paused, waiting for a card). */
  readonly active = signal(false);
  readonly index = signal(0);
  /** The next step needs an SD card and none is chosen: nothing is shown until one is. */
  readonly waitingForCard = signal(false);

  readonly step = computed<TourStep>(() => this.steps[this.index()] ?? this.steps[0]!);
  readonly isFirst = computed(() => this.index() === 0);
  readonly isLast = computed(() => this.index() === this.steps.length - 1);
  readonly hasCard = computed(() => Boolean(this.settingsStore.settings()?.sdRoot));
  /** On screen: running, not paused, and no dialog or the support popup over the window. */
  readonly visible = computed(() => this.active() && !this.waitingForCard() && !this.dialogs.anyOpen() && !this.donate.open());

  private autoStartChecked = false;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // The first start: once the settings are known, the tour starts unless it was finished or skipped before.
    effect(() => {
      const settings = this.settingsStore.settings();
      if (!settings || this.autoStartChecked) return;
      this.autoStartChecked = true;
      if (!settings.ui.tourDone) setTimeout(() => untracked(() => this.start()), START_DELAY_MS);
    });

    // A card was chosen: the paused tour goes on; on the first step (the card button) the tour moves to the next one.
    let hadCard: boolean | null = null;
    effect(() => {
      const hasCard = this.hasCard();
      const loaded = this.settingsStore.settings() !== null;
      untracked(() => {
        const chosenNow = hadCard === false && hasCard;
        if (loaded) hadCard = hasCard;
        if (!chosenNow || !this.active()) return;
        if (this.waitingForCard()) {
          clearTimeout(this.resumeTimer);
          this.resumeTimer = setTimeout(() => this.waitingForCard.set(false), RESUME_DELAY_MS);
        } else if (this.index() === 0) {
          this.go(1);
        }
      });
    });
  }

  /** Starts from the first step (the first start, or "Restart tour"). */
  start(): void {
    clearTimeout(this.resumeTimer);
    this.index.set(0);
    this.waitingForCard.set(false);
    this.active.set(true);
  }

  next(): void {
    if (!this.active()) return;
    if (this.isLast()) this.finish();
    else this.go(this.index() + 1);
  }

  back(): void {
    if (!this.active() || this.isFirst()) return;
    this.waitingForCard.set(false);
    this.index.update((index) => index - 1);
  }

  /** "Skip tour", Esc, or "Done" on the last step: the tour is not shown by itself again. */
  finish(): void {
    clearTimeout(this.resumeTimer);
    this.active.set(false);
    this.waitingForCard.set(false);
    void this.settingsStore.save({ ui: { tourDone: true } }).catch(() => {
      // Not saved (no connection): the tour simply shows again at the next start.
    });
  }

  private go(index: number): void {
    const step = this.steps[index];
    if (!step) return;
    this.index.set(index);
    if (step.needsCard && !this.hasCard()) {
      this.waitingForCard.set(true);
      this.toasts.push('info', this.i18n.t('tour.waitingForCard'));
    }
  }
}
