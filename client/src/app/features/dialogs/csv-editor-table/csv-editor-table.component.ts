import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { inputValue } from '../../../shared/utils/dom.utils';
import type { VisibleCsvRow } from '../csv-editor-dialog/csv-editor.models';

/** Editable table of the CSV rows. Presentational. */
@Component({
  selector: 'app-csv-editor-table',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './csv-editor-table.component.html',
  styleUrl: './csv-editor-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'rounded-md border border-shell-200 dark:border-shell-800' },
})
export class CsvEditorTableComponent {
  readonly headers = input.required<readonly string[]>();
  /** Rows to show on the current page. */
  readonly rows = input.required<readonly VisibleCsvRow[]>();
  readonly totalVisible = input.required<number>();
  readonly limit = input.required<number>();
  readonly keyColumn = input.required<number>();
  /** Indexes of the duplicate rows. */
  readonly duplicates = input.required<ReadonlySet<number>>();

  readonly cellChange = output<{ id: number; column: number; value: string }>();
  readonly rowRemove = output<number>();
  readonly showMore = output<void>();

  protected readonly valueOf = inputValue;
}
