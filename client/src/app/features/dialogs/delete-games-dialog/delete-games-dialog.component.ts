import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LibraryFile } from '@shared/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FormatService } from '../../../core/services/format.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { inputChecked } from '../../../shared/utils/dom.utils';

const LISTED_LIMIT = 50;

/** Confirmation of deleting all checked games. Presentational: the operation runs in the parent. */
@Component({
  selector: 'app-delete-games-dialog',
  imports: [ModalComponent, IconComponent, TranslatePipe],
  templateUrl: './delete-games-dialog.component.html',
  styleUrl: './delete-games-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteGamesDialogComponent implements OnInit {
  protected readonly fmt = inject(FormatService);
  private readonly i18n = inject(I18nService);

  readonly games = input.required<LibraryFile[]>();
  readonly csvReady = input.required<boolean>();
  readonly busy = input(false);

  readonly confirmed = output<boolean>();
  readonly cancelled = output<void>();

  protected readonly checkedOf = inputChecked;
  protected readonly alsoCsv = signal(true);
  protected readonly count = computed(() => this.games().length);
  protected readonly total = computed(() => this.games().reduce((sum, game) => sum + game.size, 0));
  protected readonly noun = computed(() => this.i18n.plural('plural.game', this.count()));
  protected readonly listed = computed(() => this.games().slice(0, LISTED_LIMIT));
  protected readonly hiddenCount = computed(() => Math.max(0, this.count() - LISTED_LIMIT));

  ngOnInit(): void {
    this.alsoCsv.set(this.csvReady());
  }

  protected close(): void {
    if (!this.busy()) this.cancelled.emit();
  }
}
