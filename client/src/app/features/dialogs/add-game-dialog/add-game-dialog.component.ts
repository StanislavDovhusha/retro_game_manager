import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { AddGameResponse } from '@shared/api';
import { DropZoneComponent } from '../../../shared/components/drop-zone/drop-zone.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { LatinInputDirective } from '../../../shared/directives/latin-input.directive';
import { inputChecked, inputValue } from '../../../shared/utils/dom.utils';
import { fileExt } from '../../../shared/utils/text.utils';
import type { TargetKind } from './add-game.rules';
import { AddGameService } from './add-game.service';

/** Adding a game: the game file(s), the title and an optional image. */
@Component({
  selector: 'app-add-game-dialog',
  imports: [ModalComponent, IconComponent, DropZoneComponent, TranslatePipe, LatinInputDirective],
  providers: [AddGameService],
  templateUrl: './add-game-dialog.component.html',
  styleUrl: './add-game-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddGameDialogComponent implements OnInit {
  protected readonly state = inject(AddGameService);

  /** Game extensions from the settings. */
  readonly extensions = input.required<string[]>();
  readonly added = output<AddGameResponse>();
  readonly closed = output<void>();

  protected readonly valueOf = inputValue;
  protected readonly checkedOf = inputChecked;
  protected readonly extensionOf = fileExt;
  /** The line under the game files: what they become. */
  protected readonly targetLabels: Record<TargetKind, string> = {
    file: 'addGame.fileTarget',
    disc: 'addGame.discTarget',
    clonecd: 'addGame.cloneCdTarget',
    ecm: 'addGame.ecmTarget',
    zip: 'addGame.zipTarget',
  };
  protected readonly shortHint = computed(() =>
    this.state.title().trim() && !this.state.shortName() ? 'addGame.shortNeedsLetter' : 'addGame.shortReadonly');

  ngOnInit(): void {
    this.state.start(this.extensions());
  }

  protected close(): void {
    if (!this.state.busy()) this.closed.emit();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  protected async submit(): Promise<void> {
    const result = await this.state.submit();
    if (!result) return;
    this.added.emit(result);
    this.closed.emit();
  }
}
