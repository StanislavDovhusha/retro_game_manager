import { ChangeDetectionStrategy, Component, OnInit, inject, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { SyncPreviewComponent } from '../sync-preview/sync-preview.component';
import { SyncReportComponent } from '../sync-report/sync-report.component';
import { SyncService } from './sync.service';

/** CSV sync: a preview of the changes, then the sync itself. */
@Component({
  selector: 'app-sync-dialog',
  imports: [ModalComponent, IconComponent, SyncPreviewComponent, SyncReportComponent, TranslatePipe],
  providers: [SyncService],
  templateUrl: './sync-dialog.component.html',
  styleUrl: './sync-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncDialogComponent implements OnInit {
  protected readonly state = inject(SyncService);

  readonly closed = output<void>();

  ngOnInit(): void {
    void this.state.loadPreview();
  }

  protected close(): void {
    if (!this.state.applying()) this.closed.emit();
  }
}
