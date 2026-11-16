import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ColumnKey, LibraryFile } from '@shared/models';
import { VirtualListComponent } from '../../../shared/components/virtual-list/virtual-list.component';
import type { SearchScope, SortKey, SortState } from '../../../shared/models/ui.models';
import type { ActiveEdit, EditField } from '../../library/entry-edit.logic';
import { GameListHeaderComponent } from '../game-list-header/game-list-header.component';
import { GameListToolbarComponent } from '../game-list-toolbar/game-list-toolbar.component';
import { GameRowComponent } from '../game-row/game-row.component';
import type { InlineCommit } from '../inline-input/inline-input.component';
import { DEFAULT_WIDTHS, HEADER_HEIGHT, ROW_HEIGHT, contentWidth, gridTemplate, initialWidths } from './game-columns';

/** Game table: toolbar, resizable headers and virtualized rows. Presentational. */
@Component({
  selector: 'app-game-list',
  imports: [TranslatePipe, VirtualListComponent, GameListToolbarComponent, GameListHeaderComponent, GameRowComponent],
  templateUrl: './game-list.component.html',
  styleUrl: './game-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameListComponent {
  /** Already filtered and sorted. */
  readonly games = input.required<LibraryFile[]>();
  readonly query = input.required<string>();
  readonly scope = input.required<SearchScope>();
  readonly sort = input.required<SortState>();
  readonly checked = input.required<ReadonlySet<string>>();
  readonly selectedRel = input<string | null>(null);
  readonly selectedDir = input<string | null>(null);
  readonly csvReady = input.required<boolean>();
  readonly version = input.required<number>();
  /** Saved column widths. */
  readonly columnWidths = input<Partial<Record<ColumnKey, number>>>({});
  /** The cell that is being edited (null when none). */
  readonly edit = input<ActiveEdit | null>(null);

  readonly sortBy = output<SortKey>();
  readonly rowSelect = output<string>();
  readonly setCheckedRels = output<{ rels: string[]; value: boolean }>();
  readonly clearChecked = output<void>();
  readonly deleteChecked = output<void>();
  readonly clearDir = output<void>();
  /** The user finished changing the column widths. */
  readonly columnWidthsChange = output<Record<ColumnKey, number>>();
  readonly editStart = output<{ rel: string; field: EditField }>();
  readonly editDraft = output<string>();
  readonly editCommit = output<InlineCommit>();
  readonly editCancel = output<void>();

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly headerHeight = HEADER_HEIGHT;

  private readonly list = viewChild(VirtualListComponent);

  protected readonly widths = signal<Record<ColumnKey, number>>({ ...DEFAULT_WIDTHS });
  private lastIndex: number | null = null;
  private widthsLoaded = false;

  protected readonly gridTemplate = computed(() => gridTemplate(this.widths()));
  protected readonly contentWidth = computed(() => contentWidth(this.widths()));

  protected readonly allRels = computed(() => this.games().map((game) => game.rel));
  private readonly checkedVisible = computed(() => this.games().reduce((count, game) => count + (this.checked().has(game.rel) ? 1 : 0), 0));
  protected readonly allChecked = computed(() => this.games().length > 0 && this.checkedVisible() === this.games().length);
  protected readonly partiallyChecked = computed(() => this.checkedVisible() > 0 && !this.allChecked());
  protected readonly hiddenChecked = computed(() => this.checked().size - this.checkedVisible());
  protected readonly nameQuery = computed(() => (this.scope() === 'ext' || this.scope() === 'dir' ? '' : this.query()));
  protected readonly tagsQuery = computed(() => (this.scope() === 'tags' || this.scope() === 'all' ? this.query() : ''));
  protected readonly pathQuery = computed(() => (['path', 'dir', 'all'].includes(this.scope()) ? this.query() : ''));
  protected readonly resetKey = computed(() => `${this.query()}|${this.scope()}|${this.selectedDir()}|${this.sort().key}|${this.sort().dir}`);
  protected readonly itemKey = (index: number): string => this.games()[index]?.rel ?? String(index);

  constructor() {
    // Saved widths are applied once, when the settings arrive.
    effect(() => {
      const saved = this.columnWidths();
      if (this.widthsLoaded) return;
      if (Object.keys(saved).length === 0) return;
      this.widthsLoaded = true;
      this.widths.set(initialWidths(saved));
    });

    // A selection in the tree on the left scrolls the table to the game.
    effect(() => {
      const rel = this.selectedRel();
      untracked(() => {
        if (!rel) return;
        this.list()?.scrollToIndex(this.games().findIndex((game) => game.rel === rel));
      });
    });
  }

  protected toggleAll(): void {
    this.setCheckedRels.emit({ rels: this.allRels(), value: !this.allChecked() });
  }

  /** Click on a row checkbox; Shift selects the range from the previously checked row. */
  protected onCheck(index: number, event: MouseEvent): void {
    event.stopPropagation();
    const games = this.games();
    const target = games[index];
    if (!target) return;
    const value = !this.checked().has(target.rel);
    if (event.shiftKey && this.lastIndex !== null) {
      const from = Math.min(this.lastIndex, index);
      const to = Math.max(this.lastIndex, index);
      this.setCheckedRels.emit({ rels: games.slice(from, to + 1).map((game) => game.rel), value });
    } else {
      this.setCheckedRels.emit({ rels: [target.rel], value });
    }
    this.lastIndex = index;
  }

  protected setWidths(widths: Record<ColumnKey, number>): void {
    this.widths.set(widths);
  }

  protected commitWidths(widths: Record<ColumnKey, number>): void {
    this.widths.set(widths);
    this.columnWidthsChange.emit(widths);
  }
}
