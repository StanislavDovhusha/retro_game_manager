import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { ColumnKey } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { IconName } from '../../../shared/components/icon/icons';
import type { SortKey, SortState } from '../../../shared/models/ui.models';
import { COLUMNS, DEFAULT_WIDTHS, MIN_WIDTHS, clampWidth } from '../game-list/game-columns';

const LABEL_KEYS: Record<ColumnKey, string> = {
  name: 'gameList.columns.game',
  path: 'gameList.columns.path',
  tags: 'gameList.columns.tags',
  size: 'gameList.columns.size',
  csv: 'gameList.columns.csv'
};

/** Column headers of the game table: sorting and column resizing (mouse and keyboard). Presentational. */
@Component({
  selector: 'app-game-list-header',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './game-list-header.component.html',
  styleUrl: './game-list-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameListHeaderComponent {
  readonly widths = input.required<Record<ColumnKey, number>>();
  readonly gridTemplate = input.required<string>();
  readonly sort = input.required<SortState>();

  readonly sortBy = output<SortKey>();
  /** Live width while a border is being dragged. */
  readonly widthChange = output<Record<ColumnKey, number>>();
  /** The user finished changing the width of a column. */
  readonly widthCommit = output<Record<ColumnKey, number>>();

  protected readonly columns = COLUMNS;
  protected readonly defaults = DEFAULT_WIDTHS;
  protected readonly labelKeys = LABEL_KEYS;
  private drag: { key: ColumnKey; startX: number; startWidth: number } | null = null;

  protected sortIcon(key: ColumnKey): IconName {
    const sort = this.sort();
    if (sort.key !== key) return 'arrow-up-down';
    return sort.dir === 'asc' ? 'arrow-up' : 'arrow-down';
  }

  protected sortTitleKey(key: ColumnKey): string {
    const sort = this.sort();
    if (sort.key !== key) return 'gameList.sort';
    return 'gameList.sortTitle';
  }

  protected sortDirectionKey(): string {
    return this.sort().dir === 'asc' ? 'gameList.ascending' : 'gameList.descending';
  }

  protected asSortKey(key: ColumnKey): SortKey {
    return key === 'size' || key === 'csv' ? key : 'name';
  }

  private dragWidth(event: PointerEvent): number {
    const drag = this.drag;
    return drag ? clampWidth(drag.key, drag.startWidth + event.clientX - drag.startX) : 0;
  }

  protected onHandleDown(key: ColumnKey, event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = { key, startX: event.clientX, startWidth: this.widths()[key] };
  }

  protected onHandleMove(event: PointerEvent): void {
    if (!this.drag) return;
    const { key } = this.drag;
    const width = this.dragWidth(event);
    if (this.widths()[key] !== width) this.widthChange.emit({ ...this.widths(), [key]: width }); // updated in real time
  }

  protected onHandleUp(event: PointerEvent): void {
    if (!this.drag) return;
    const { key } = this.drag;
    const next = { ...this.widths(), [key]: this.dragWidth(event) };
    this.drag = null;
    this.widthCommit.emit(next);
  }

  protected commit(key: ColumnKey, width: number): void {
    this.widthCommit.emit({ ...this.widths(), [key]: clampWidth(key, width) });
  }

  protected onHandleKey(key: ColumnKey, event: KeyboardEvent): void {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === 'ArrowRight') { event.preventDefault(); this.commit(key, this.widths()[key] + step); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); this.commit(key, this.widths()[key] - step); }
    else if (event.key === 'Home') { event.preventDefault(); this.commit(key, MIN_WIDTHS[key]); }
  }
}
