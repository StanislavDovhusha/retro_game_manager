import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { inputChecked } from '../../../shared/utils/dom.utils';
import type { DeleteRequest } from '../../library/library.models';

/** Confirmation of deleting one game file or its image. Presentational: the operation runs in the parent. */
@Component({
  selector: 'app-delete-game-dialog',
  imports: [ModalComponent, IconComponent, TranslatePipe],
  templateUrl: './delete-game-dialog.component.html',
  styleUrl: './delete-game-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteGameDialogComponent implements OnInit {
  readonly request = input.required<DeleteRequest>();
  readonly csvReady = input.required<boolean>();
  readonly busy = input(false);

  /** Confirmed; the value tells whether the CSV entry has to be removed as well. */
  readonly confirmed = output<boolean>();
  readonly cancelled = output<void>();

  protected readonly checkedOf = inputChecked;
  protected readonly alsoCsv = signal(true);
  protected readonly isGame = computed(() => this.request().kind === 'game');
  protected readonly name = computed(() => {
    const { kind, game } = this.request();
    return kind === 'game' ? game.fileName : game.imageName;
  });
  protected readonly target = computed(() => {
    const { kind, game } = this.request();
    return kind === 'game' ? game.abs : game.imageAbs ?? '';
  });

  ngOnInit(): void {
    this.alsoCsv.set(this.csvReady());
  }

  protected close(): void {
    if (!this.busy()) this.cancelled.emit();
  }
}
