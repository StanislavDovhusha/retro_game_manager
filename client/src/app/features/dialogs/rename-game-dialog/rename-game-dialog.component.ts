import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { RenameGameResponse } from '@shared/api';
import type { LibraryFile } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LatinInputDirective } from '../../../shared/directives/latin-input.directive';
import { inputValue } from '../../../shared/utils/dom.utils';
import { RenameGameService } from './rename-game.service';

/** Game rename: the game file, cover, CSV entry, saves and cubegm lists. */
@Component({
  selector: 'app-rename-game-dialog',
  imports: [ModalComponent, IconComponent, TranslatePipe, LatinInputDirective],
  providers: [RenameGameService],
  templateUrl: './rename-game-dialog.component.html',
  styleUrl: './rename-game-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenameGameDialogComponent implements OnInit {
  protected readonly state = inject(RenameGameService);

  readonly game = input.required<LibraryFile>();
  readonly renamed = output<RenameGameResponse>();
  readonly closed = output<void>();

  protected readonly valueOf = inputValue;

  ngOnInit(): void {
    this.state.start(this.game());
  }

  protected close(): void {
    if (!this.state.busy()) this.closed.emit();
  }

  protected async submit(): Promise<void> {
    const result = await this.state.submit();
    if (!result) return;
    this.renamed.emit(result);
    this.closed.emit();
  }
}
