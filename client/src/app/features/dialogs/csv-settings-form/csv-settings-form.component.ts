import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CSV_DELIMITERS, ENCODINGS } from '@shared/constants';
import type { CsvColumnNames, PublicSettings } from '@shared/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { inputValue } from '../../../shared/utils/dom.utils';

export type CsvColumnName = keyof CsvColumnNames;
/** A change of the CSV reading parameters (everything except the column mapping). */
export type CsvSettingsPatch = Partial<Omit<PublicSettings['csv'], 'columns'>>;

const COLUMN_NAMES: readonly CsvColumnName[] = ['path', 'name', 'short', 'tags'];

/** Form with the CSV reading parameters: delimiter, encoding, header, columns and path prefix. Presentational. */
@Component({
  selector: 'app-csv-settings-form',
  imports: [TranslatePipe],
  templateUrl: './csv-settings-form.component.html',
  styleUrl: './csv-settings-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvSettingsFormComponent {
  private readonly i18n = inject(I18nService);

  readonly csv = input.required<PublicSettings['csv']>();
  readonly csvPath = input.required<string>();
  /** Column names found in the CSV (empty while the file is not read). */
  readonly headers = input.required<readonly string[]>();
  readonly encodings = input.required<readonly string[]>();

  readonly csvChange = output<CsvSettingsPatch>();
  readonly columnChange = output<{ key: CsvColumnName; value: string }>();

  protected readonly valueOf = inputValue;
  protected readonly columnNames = COLUMN_NAMES;

  protected autoLabel(key: CsvColumnName): string {
    if (key === 'path') return this.i18n.t('settings.columns.auto.path');
    if (this.csv().hasHeader) return this.i18n.t('settings.columns.auto.unused');
    return this.i18n.t('settings.columns.auto.column', { number: key === 'name' ? 2 : key === 'short' ? 3 : 4 });
  }

  protected setDelimiter(value: string): void {
    const delimiter = CSV_DELIMITERS.find((candidate) => candidate === value);
    if (delimiter) this.csvChange.emit({ delimiter });
  }

  protected setEncoding(value: string): void {
    const encoding = ENCODINGS.find((candidate) => candidate === value);
    if (encoding) this.csvChange.emit({ encoding });
  }
}
