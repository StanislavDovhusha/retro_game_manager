import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { SearchGame } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { SearchScope } from '../../../shared/models/ui.models';
import { inputValue } from '../../../shared/utils/dom.utils';
import { SearchResultComponent } from '../../search/search-result/search-result.component';

/** Ids of the list and its options (the field points at them through aria-controls / aria-activedescendant). */
const LIST_ID = 'global-search-results';
const optionId = (index: number): string => `global-search-option-${index}`;

/**
 * The search field of the header: the query, the filter scope of the open folder, the number of games it shows, and
 * the drop-down list of games found on every platform folder of the card. The list is a combobox: ↓/↑ move through
 * the results (the last item is "Show all results"), Enter opens the highlighted one, Esc closes the list; a click
 * outside closes it too. Presentational.
 */
@Component({
  selector: 'app-search-box',
  imports: [IconComponent, TranslatePipe, SearchResultComponent],
  templateUrl: './search-box.component.html',
  styleUrl: './search-box.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBoxComponent {
  readonly query = input.required<string>();
  readonly scope = input.required<SearchScope>();
  /** Games of the open folder that match (the filter of the table). */
  readonly resultCount = input<number | null>(null);
  /** The query the results were found for (it follows the field after a pause in typing). */
  readonly term = input('');
  /** The first results of the global search. */
  readonly results = input<readonly SearchGame[]>([]);
  /** All the results of the global search. */
  readonly total = input(0);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** Platform folders that could not be read. */
  readonly unreadable = input<readonly string[]>([]);

  readonly queryChange = output<string>();
  readonly scopeChange = output<SearchScope>();
  readonly openResult = output<SearchGame>();
  readonly showAll = output<void>();

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly val = inputValue;
  protected readonly listId = LIST_ID;
  protected readonly optionId = optionId;
  protected readonly scopes: readonly { value: SearchScope; labelKey: string }[] = [
    { value: 'all', labelKey: 'header.search.scope.all' },
    { value: 'name', labelKey: 'header.search.scope.name' },
    { value: 'path', labelKey: 'header.search.scope.path' },
    { value: 'ext', labelKey: 'header.search.scope.ext' },
    { value: 'dir', labelKey: 'header.search.scope.dir' },
    { value: 'tags', labelKey: 'header.search.scope.tags' },
  ];

  /** The user wants the list (typing, focus); Esc, a click outside or a choice closes it. */
  protected readonly wanted = signal(false);
  /** Highlighted item: a result, `results().length` for "Show all results", -1 for none. */
  protected readonly active = signal(-1);
  protected readonly expanded = computed(() => this.wanted() && this.term().trim() !== '' && this.query().trim() !== '');
  /** Items the arrows move through: the results and the "Show all results" link. */
  private readonly itemCount = computed(() => (this.total() > 0 ? this.results().length + 1 : 0));
  protected readonly activeId = computed(() => (this.expanded() && this.active() >= 0 ? optionId(this.active()) : null));

  constructor() {
    // New results: nothing is highlighted any more.
    effect(() => {
      this.results();
      untracked(() => this.active.set(-1));
    });
  }

  protected asScope(value: string): SearchScope {
    return this.scopes.find((s) => s.value === value)?.value ?? 'all';
  }

  protected onInput(event: Event): void {
    this.queryChange.emit(inputValue(event));
    this.wanted.set(true);
  }

  protected clear(): void {
    this.queryChange.emit('');
    this.field()?.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.itemCount();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault(); // the caret stays where it is
        if (!this.expanded()) {
          this.wanted.set(true);
          return;
        }
        if (count === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        // From "nothing highlighted" ↓ goes to the first item and ↑ to the last; the ends wrap around.
        const from = this.active() < 0 ? (step > 0 ? -1 : count) : this.active();
        this.move((from + step + count) % count);
        return;
      }
      case 'Enter': {
        if (!this.expanded() || this.active() < 0) return;
        event.preventDefault();
        this.choose(this.active());
        return;
      }
      case 'Escape':
        if (this.expanded()) {
          event.preventDefault();
          event.stopPropagation();
          this.close();
        }
        return;
    }
  }

  /** Focus left the field and the list (a click elsewhere, Tab): the list closes. */
  protected onFocusOut(event: FocusEvent, box: HTMLElement): void {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !box.contains(next)) this.close();
  }

  /** A click on an item: the field keeps the focus (mousedown is cancelled), the click opens the item. */
  protected choose(index: number): void {
    const game = this.results()[index];
    this.close();
    if (game) this.openResult.emit(game);
    else this.showAll.emit();
  }

  private move(index: number): void {
    this.active.set(index);
    // Keep the highlighted item in view inside the scrolling list.
    requestAnimationFrame(() => document.getElementById(optionId(index))?.scrollIntoView({ block: 'nearest' }));
  }

  private close(): void {
    this.wanted.set(false);
    this.active.set(-1);
  }
}
