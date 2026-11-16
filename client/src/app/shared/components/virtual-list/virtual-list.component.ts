import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, TemplateRef, afterNextRender, computed, contentChild, effect, inject,
  input, signal, untracked, viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/** Row template context: `<ng-template #row let-i>`. */
export interface RowContext {
  $implicit: number;
}

/**
 * Virtual list with a fixed row height: only the visible rows and a small buffer are in the DOM.
 * A spacer sets the full height, so the scrollbar behaves as usual and the scroll position
 * is not reset when the data is refreshed.
 * Templates: `#row` (a row), `#header` (sticky header, optional), `#empty` (shown when there are no rows).
 */
@Component({
  selector: 'app-virtual-list',
  imports: [NgTemplateOutlet],
  templateUrl: './virtual-list.component.html',
  styleUrl: './virtual-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VirtualListComponent {
  readonly count = input.required<number>();
  readonly rowHeight = input.required<number>();
  /** How many rows to render beyond the visible area (buffer). */
  readonly overscan = input(8);
  readonly headerHeight = input(0);
  /** Minimum content width: when it is wider than the window, horizontal scrolling appears. */
  readonly minWidth = input<number | null>(null);
  /** When the value changes the scroll position returns to the top (filter or sort change). */
  readonly resetKey = input<unknown>(null);
  readonly itemKey = input.required<(index: number) => string>();
  readonly className = input('');

  protected readonly rowTpl = contentChild.required<TemplateRef<RowContext>>('row');
  protected readonly headerTpl = contentChild<TemplateRef<unknown>>('header');
  protected readonly emptyTpl = contentChild<TemplateRef<unknown>>('empty');
  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

  private readonly top = signal(0);
  private readonly height = signal(600);
  private frame = 0;

  protected readonly indices = computed(() => {
    const rowHeight = this.rowHeight();
    const start = Math.max(0, Math.floor(this.top() / rowHeight) - this.overscan());
    const end = Math.min(this.count(), Math.ceil((this.top() + this.height()) / rowHeight) + this.overscan());
    const out: number[] = [];
    for (let i = start; i < end; i += 1) out.push(i);
    return out;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      const measure = () => this.height.set(el.clientHeight);
      measure();
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));

    effect(() => {
      this.resetKey();
      const el = this.scroller()?.nativeElement; // the element does not exist before the first render
      untracked(() => {
        if (el) el.scrollTop = 0;
        this.top.set(0);
      });
    });
  }

  protected onScroll(): void {
    if (this.frame) return; // at most one update per frame
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const el = this.scroller()?.nativeElement;
      if (el) this.top.set(el.scrollTop);
    });
  }

  /** Scrolls so that the row is fully visible. */
  scrollToIndex(index: number): void {
    const el = this.scroller()?.nativeElement;
    if (!el || index < 0) return;
    const header = this.headerHeight();
    const itemTop = header + index * this.rowHeight();
    const itemBottom = itemTop + this.rowHeight();
    if (itemTop < el.scrollTop + header) el.scrollTop = itemTop - header;
    else if (itemBottom > el.scrollTop + el.clientHeight) el.scrollTop = itemBottom - el.clientHeight;
    this.top.set(el.scrollTop);
  }
}
