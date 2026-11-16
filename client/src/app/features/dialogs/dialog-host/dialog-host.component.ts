import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import type { PublicSettings } from '@shared/models';
import { PresentDirective } from '../../../shared/directives/present.directive';
import { DonatePopupComponent } from '../../donate/donate-popup/donate-popup.component';
import { DonateService } from '../../donate/donate.service';
import { TourService } from '../../tour/tour.service';
import { GameActionsService } from '../../library/game-actions.service';
import { LibraryViewService } from '../../library/library-view.service';
import { AddGameDialogComponent } from '../add-game-dialog/add-game-dialog.component';
import { DeleteGameDialogComponent } from '../delete-game-dialog/delete-game-dialog.component';
import { DeleteGamesDialogComponent } from '../delete-games-dialog/delete-games-dialog.component';
import { DialogStateService } from '../dialog-state.service';
import { LibraryPathsDialogComponent } from '../library-paths-dialog/library-paths-dialog.component';
import { RenameGameDialogComponent } from '../rename-game-dialog/rename-game-dialog.component';
import { SettingsDialogComponent } from '../settings-dialog/settings-dialog.component';
import { SyncDialogComponent } from '../sync-dialog/sync-dialog.component';
import { TipsDialogComponent } from '../../start-tips/tips-dialog/tips-dialog.component';

/** Renders the dialogs that are open and connects them to the library operations. Smart. */
@Component({
  selector: 'app-dialog-host',
  imports: [
    SettingsDialogComponent, SyncDialogComponent, AddGameDialogComponent, RenameGameDialogComponent, LibraryPathsDialogComponent,
    DeleteGameDialogComponent, DeleteGamesDialogComponent, DonatePopupComponent, TipsDialogComponent, PresentDirective,
  ],
  templateUrl: './dialog-host.component.html',
  styleUrl: './dialog-host.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogHostComponent {
  protected readonly dialogs = inject(DialogStateService);
  protected readonly actions = inject(GameActionsService);
  protected readonly view = inject(LibraryViewService);
  protected readonly donate = inject(DonateService);
  private readonly tour = inject(TourService);

  readonly settings = input.required<PublicSettings>();

  constructor() {
    // The support popup that is due waits until the upload, conversion, rename, scan… are finished, the dialogs are
    // closed and the start-up tour is not on screen.
    effect(() => {
      if (this.donate.pending() && !this.actions.working() && !this.dialogs.anyOpen() && !this.tour.visible()) {
        untracked(() => this.donate.showWhenIdle());
      }
    });
    // The host exists once the settings are loaded: the start of the application is recorded for the support popup.
    void this.donate.registerLaunch();
  }
}
