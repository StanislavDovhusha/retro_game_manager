import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { copyText } from '../../../shared/utils/clipboard.utils';
import type { CryptoRequisite } from '../donate.config';
import { DRAG_START_PX, qrShape, swipeStep, wrapIndex } from './crypto-slider.logic';

/** How long the button shows "Copied!". */
const COPIED_MS = 1600;

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  /** The press has moved far enough sideways to be a swipe (a click otherwise). */
  active: boolean;
}

/**
 * The crypto wallets of the "Support the project" popup, one coin per slide: the coin, its network, the address with
 * its QR code (drawn here, nothing is loaded from the internet), a "Copy" button and a warning to use that network
 * only. Turned by the arrows, the dots, a swipe (touch or mouse) and the ←/→ keys; the ends wrap around. The slide
 * animation is off with prefers-reduced-motion (see the stylesheet). Presentational.
 */
@Component({
  selector: 'app-crypto-slider',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './crypto-slider.component.html',
  styleUrl: './crypto-slider.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CryptoSliderComponent {
  /** Coins with an address. */
  readonly coins = input.required<readonly CryptoRequisite[]>();

  protected readonly index = signal(0);
  /** Pixels the track follows the finger during a swipe. */
  protected readonly dragPx = signal(0);
  protected readonly dragging = signal(false);
  protected readonly copiedId = signal<string | null>(null);

  protected readonly current = computed(() => this.coins()[Math.min(this.index(), this.coins().length - 1)] ?? null);
  protected readonly shapes = computed(() => this.coins().map((coin) => qrShape(coin.address.trim())));
  protected readonly transform = computed(() => `translateX(calc(${-this.index() * 100}% + ${this.dragPx()}px))`);

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private drag: Drag | null = null;
  /** A swipe has just ended: the click that the browser sends after it is not a click on a button. */
  private swallowClick = false;
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.copiedTimer));
  }

  protected go(step: number): void {
    this.index.update((index) => wrapIndex(index, step, this.coins().length));
  }

  protected show(index: number): void {
    this.index.set(index);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    this.go(event.key === 'ArrowRight' ? 1 : -1);
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || this.coins().length < 2) return;
    this.drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startedAt: event.timeStamp, active: false };
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (!drag.active) {
      // A mostly vertical move is a scroll of the window, not a swipe.
      if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(event.clientY - drag.startY)) return;
      drag.active = true;
      this.dragging.set(true);
      this.viewport().nativeElement.setPointerCapture(event.pointerId);
    }
    this.dragPx.set(dx);
  }

  protected onPointerUp(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    this.drag = null;
    if (!drag.active) return;
    const width = this.viewport().nativeElement.clientWidth;
    const step = event.type === 'pointercancel' ? 0 : swipeStep(event.clientX - drag.startX, width, event.timeStamp - drag.startedAt);
    this.swallowClick = true;
    this.dragging.set(false);
    this.dragPx.set(0);
    if (step) this.go(step);
  }

  /** Capture phase: the click that ends a swipe does not reach the buttons under the finger. */
  protected onClickCapture(event: Event): void {
    if (!this.swallowClick) return;
    this.swallowClick = false;
    event.stopPropagation();
    event.preventDefault();
  }

  protected async copy(coin: CryptoRequisite): Promise<void> {
    if (!(await copyText(coin.address.trim()))) return;
    this.copiedId.set(coin.id);
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => this.copiedId.set(null), COPIED_MS);
  }
}
