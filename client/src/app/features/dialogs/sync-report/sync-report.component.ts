import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { SyncReportOk } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** Result of a completed sync. Presentational. */
@Component({
  selector: 'app-sync-report',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './sync-report.component.html',
  styleUrl: './sync-report.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncReportComponent {
  readonly report = input.required<SyncReportOk>();
}
