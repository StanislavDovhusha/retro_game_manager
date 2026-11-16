import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { inputValue } from '../../../shared/utils/dom.utils';

/** Filter, row actions and the summary above the CSV table. Presentational. */
@Component({
  selector: 'app-csv-editor-toolbar',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './csv-editor-toolbar.component.html',
  styleUrl: './csv-editor-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvEditorToolbarComponent {
  readonly filter = input.required<string>();
  readonly rowCount = input.required<number>();
  readonly shownCount = input.required<number>();
  readonly duplicateCount = input.required<number>();
  readonly keyName = input.required<string>();
  readonly dirty = input.required<boolean>();
  readonly checking = input(false);
  readonly removing = input(false);

  readonly filterChange = output<string>();
  readonly addRow = output<void>();
  readonly removeDuplicates = output<void>();
  readonly removeMissing = output<void>();

  protected readonly valueOf = inputValue;
}
