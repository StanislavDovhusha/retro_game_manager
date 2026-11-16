import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { MissingPreviewResponse } from '@shared/api';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';

const LISTED_LIMIT = 50;

/** Confirmation of removing the CSV entries of the games that have no file. Presentational. */
@Component({
  selector: 'app-missing-games-dialog',
  imports: [ModalComponent, IconComponent, TranslatePipe],
  templateUrl: './missing-games-dialog.component.html',
  styleUrl: './missing-games-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MissingGamesDialogComponent {
  readonly missing = input.required<MissingPreviewResponse>();
  readonly removing = input(false);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly listed = computed(() => this.missing().paths.slice(0, LISTED_LIMIT));
  protected readonly hiddenCount = computed(() => Math.max(0, this.missing().count - LISTED_LIMIT));
}
