import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PlatformCardComponent } from '../platform-card/platform-card.component';
import { columnsOf, gridMove, isGridKey, type PlatformCardItem } from '../platforms.logic';

/**
 * The platform folders of the card as a grid of cards that fits the width of the window. The arrow keys (and Home,
 * End) move between the cards, Enter or a click opens one. When the list comes back (from a platform), the card of
 * that platform gets the focus. Presentational.
 */
@Component({
  selector: 'app-platform-list',
  imports: [PlatformCardComponent, TranslatePipe, IconComponent],
  templateUrl: './platform-list.component.html',
  styleUrl: './platform-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformListComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly items = input.required<readonly PlatformCardItem[]>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly busy = input(false);
  /** The platform that was open before: its card is focused when the list appears. */
  readonly previous = input('');

  readonly choose = output<string>();

  /** The card in the tab order. */
  protected readonly current = signal(0);
  private restored = false;

  constructor() {
    // Once the cards are there: the card of the platform that was open gets the current place, and the focus when
    // nothing else has it (the breadcrumb or the table that had it is gone).
    afterRenderEffect(() => {
      const items = this.items();
      if (this.restored || !items.length) return;
      this.restored = true;
      const index = Math.max(0, items.findIndex((item) => item.name === this.previous()));
      this.current.set(index);
      if (this.previous() && (document.activeElement === document.body || !document.activeElement)) this.focusCard(index);
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!isGridKey(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const cards = this.cards();
    if (!cards.length) return;
    const from = Math.max(0, cards.indexOf(document.activeElement as HTMLElement));
    const columns = columnsOf(cards.map((card) => card.getBoundingClientRect().top));
    const to = gridMove(from, event.key, columns, cards.length);
    event.preventDefault();
    if (to >= 0) this.focusCard(to);
  }

  private cards(): HTMLElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLElement>('.platform-card')];
  }

  private focusCard(index: number): void {
    this.current.set(index);
    this.cards()[index]?.focus();
  }
}
