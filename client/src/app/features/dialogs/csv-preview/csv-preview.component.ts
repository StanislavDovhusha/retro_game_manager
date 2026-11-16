import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { CsvPreviewResponse } from '@shared/api';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** First rows of the CSV file with the "Edit CSV" button. Presentational. */
@Component({
  selector: 'app-csv-preview',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './csv-preview.component.html',
  styleUrl: './csv-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvPreviewComponent {
  readonly csvPath = input.required<string>();
  readonly preview = input.required<CsvPreviewResponse | null>();
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** The edited settings match the saved ones, so the file can be edited. */
  readonly saved = input(true);

  readonly edit = output<void>();
}
