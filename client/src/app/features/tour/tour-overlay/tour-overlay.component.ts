import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { prefersReducedMotion } from '../../../shared/utils/dom.utils';
import { TourService } from '../tour.service';
import { type Box, type Size, type TipPlacement, blockers, intersect, placeTooltip, spotlight, tourKey } from '../tour.logic';

/** How often the highlight follows its element (the table fills in, a panel is resized, the window scrolls…). */
const FOLLOW_MS = 250;
/** Until the tooltip has been measured it is drawn here, off screen. */
const OFF_SCREEN: TipPlacement = { side: 'center', x: -10_000, y: -10_000 };

const sameBox = (a: Box | null, b: Box | null): boolean =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height);
const samePlace = (a: TipPlacement, b: TipPlacement): boolean => a.side === b.side && a.x === b.x && a.y === b.y;

const boxOf = (rect: DOMRect): Box => ({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });

/**
 * The part of an element that can be seen: its box cut by every ancestor that clips its content (a scrolling table
 * row wider than the table must not be highlighted over the next panel). Null when nothing of it is visible.
 */
function visibleBox(element: HTMLElement): Box | null {
  let box: Box | null = boxOf(element.getBoundingClientRect());
  for (let parent = element.parentElement; parent && box; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') box = intersect(box, boxOf(parent.getBoundingClientRect()));
  }
  return box;
}

/** Typing in a field: the arrow keys belong to the field there, not to the tour. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(target.type);
}

/**
 * The start-up tour on screen: the window is dimmed except the highlighted element (it stays usable — the user can
 * press the highlighted button), and a tooltip next to it carries the step. The tooltip picks the side that fits the
 * window; the element is scrolled into view. ← / → move between the steps, Esc leaves. Smart: wired to TourService.
 */
@Component({
  selector: 'app-tour-overlay',
  imports: [TranslatePipe],
  templateUrl: './tour-overlay.component.html',
  styleUrl: './tour-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)', '(window:resize)': 'measure()' },
})
export class TourOverlayComponent {
  protected readonly tour = inject(TourService);
  private readonly tip = viewChild<ElementRef<HTMLElement>>('tip');
  private readonly primary = viewChild<ElementRef<HTMLButtonElement>>('primary');

  protected readonly view = signal<Size>({ width: 0, height: 0 }, { equal: (a, b) => a.width === b.width && a.height === b.height });
  protected readonly hole = signal<Box | null>(null, { equal: sameBox });
  protected readonly place = signal<TipPlacement>(OFF_SCREEN, { equal: samePlace });
  protected readonly blockers = computed(() => blockers(this.hole(), this.view()));
  /** The tooltip has been placed once since the tour appeared: from then on it glides between the steps. */
  protected readonly settled = signal(false);

  constructor() {
    // The tour appears: the tooltip is measured off screen first, so it does not fly in from there.
    effect(() => {
      if (this.tour.visible()) return;
      untracked(() => {
        this.place.set(OFF_SCREEN);
        this.settled.set(false);
      });
    });
    // Each shown step: the element is brought into view, then followed until the step changes or the tour hides.
    effect((onCleanup) => {
      if (!this.tour.visible()) return;
      this.tour.index();
      let focused = false;
      const first = requestAnimationFrame(() => {
        this.findTarget()?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        this.measure();
        // The second frame has the tooltip's real size (its text has been rendered): position it and take the focus.
        requestAnimationFrame(() => {
          this.measure();
          if (!focused) this.primary()?.nativeElement.focus({ preventScroll: true });
          focused = true;
          requestAnimationFrame(() => this.settled.set(true));
        });
      });
      const follow = setInterval(() => this.measure(), FOLLOW_MS);
      const onScroll = (): void => this.measure();
      window.addEventListener('scroll', onScroll, true);
      onCleanup(() => {
        cancelAnimationFrame(first);
        clearInterval(follow);
        window.removeEventListener('scroll', onScroll, true);
      });
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.tour.visible()) return;
    const action = tourKey(event.key);
    // In a field (the search, a cell being edited) the keys are the field's: Esc there cancels the edit, not the tour.
    if (!action || isTyping(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === 'next') this.tour.next();
    else if (action === 'back') this.tour.back();
    else this.tour.finish();
  }

  /** Clicks on the dimmed area do nothing (the page under it is not reachable during the tour). */
  protected swallow(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  protected measure(): void {
    if (!this.tour.visible()) return;
    const view = { width: window.innerWidth, height: window.innerHeight };
    const target = this.findTarget();
    const shown = target ? visibleBox(target) : null;
    const hole = shown ? spotlight(shown, view) : null;
    const tip = this.tip()?.nativeElement;
    const size = tip ? { width: tip.offsetWidth, height: tip.offsetHeight } : { width: 320, height: 180 };
    this.view.set(view);
    this.hole.set(hole);
    this.place.set(placeTooltip(hole, size, view, this.tour.step().side));
  }

  /** The first element of the step's list that is on screen. */
  private findTarget(): HTMLElement | null {
    for (const selector of this.tour.step().targets) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return element;
      }
    }
    return null;
  }
}
