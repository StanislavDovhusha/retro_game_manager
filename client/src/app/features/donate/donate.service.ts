import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DONATE_LAUNCH_DELAY_MS,
  afterShown,
  countActions,
  defaultDonate,
  normalizeDonate,
  registerLaunch,
  type DonateSettings,
  type Random,
} from '@shared/donate';
import { SettingsStore } from '../../core/state/settings.store';

/**
 * The "Support the project" popup: when it is open, and when it opens by itself.
 * - Automatic popup on (the settings switch): after 8–10 actions with games (`registerActions`).
 * - Automatic popup off: a rarer reminder at the start of the application, at most once a day and only after more than
 *   three days of use (`registerLaunch`, rules in shared/donate.ts).
 * The counter, the threshold, the days of use and the last show live in the application settings (they survive
 * restarts, also in the desktop app, where the page origin changes with the random port and localStorage would be lost).
 */
@Injectable({ providedIn: 'root' })
export class DonateService {
  private readonly settingsStore = inject(SettingsStore);
  /** Replaceable in tests. */
  private readonly random: Random = Math.random;
  private launchRegistered = false;

  /** The popup is on screen. */
  readonly open = signal(false);
  /**
   * The popup is due and waits until no operation runs, no dialog is open and the tour is not on screen (see
   * `showWhenIdle`): `actions` — the action threshold was reached, `launch` — the start-up reminder.
   */
  readonly pending = signal<'actions' | 'launch' | null>(null);
  /**
   * The footer button gently reminds of itself now and then. Once the popup has been opened it stops for the rest of
   * the session (kept in memory only: the next start of the application reminds again).
   */
  readonly nudge = signal(true);

  readonly settings = computed<DonateSettings>(() => normalizeDonate(this.settingsStore.settings()?.ui.donate ?? defaultDonate()));
  readonly autoShow = computed(() => this.settings().autoShow);

  /**
   * Actions with games were done: added, deleted or edited (renamed, title, short name or tags changed). Call it once
   * per finished operation with the number of games it touched: a batch counts every game, but the popup is requested
   * at most once per call, and it is shown only after the operation ends (see `showWhenIdle`).
   */
  async registerActions(count: number): Promise<void> {
    const { state, due } = countActions(this.settings(), count, this.random);
    if (state !== this.settings()) await this.save(state);
    if (due) this.pending.set('actions');
  }

  /**
   * The application has started (call once, when the settings are loaded): the day of use is recorded and, when the
   * start-up reminder is due, the popup is requested a few seconds later, once the interface has settled.
   */
  async registerLaunch(): Promise<void> {
    if (this.launchRegistered) return;
    this.launchRegistered = true;
    const { state, due } = registerLaunch(this.settings(), new Date());
    if (state !== this.settings()) await this.save(state);
    if (due) setTimeout(() => this.pending.update((pending) => pending ?? 'launch'), DONATE_LAUNCH_DELAY_MS);
  }

  /** Called when no operation is running, no dialog is open and the tour is not shown: shows the popup that is waiting. */
  showWhenIdle(): void {
    const reason = this.pending();
    if (!reason || this.open()) return;
    this.pending.set(null);
    // The switch may have been flipped while it was waiting: each reason belongs to one position of it.
    if (reason === 'actions' ? !this.autoShow() : this.autoShow()) return;
    this.show();
  }

  /**
   * The footer button, or an automatic show. Automatic shows are switched on and off only in the settings
   * (`ui.donate.autoShow`); the popup itself has no "Don't show again".
   */
  show(): void {
    this.pending.set(null);
    this.nudge.set(false);
    this.open.set(true);
    // Whoever has just seen the popup is not reminded again soon: the counter starts over with a new threshold, and the
    // time of the show keeps the start-up reminder away for 24 hours.
    void this.save(afterShown(this.settings(), this.random, Date.now()));
  }

  close(): void {
    this.open.set(false);
  }

  private async save(donate: DonateSettings): Promise<void> {
    try {
      await this.settingsStore.save({ ui: { donate } });
    } catch {
      // The counter is a convenience: a failed save must never get in the way of adding a game or opening the popup.
    }
  }
}
