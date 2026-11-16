import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import type { PublicSettings } from '@shared/models';
import { DialogStateService } from '../../dialogs/dialog-state.service';
import { UiPreferencesService } from '../../layout/ui-preferences.service';
import { EntryEditService } from '../../library/entry-edit.service';
import { GameActionsService } from '../../library/game-actions.service';
import { LibraryViewService } from '../../library/library-view.service';
import type { EditField } from '../../library/entry-edit.logic';
import { LibraryStore } from '../../../core/state/library.store';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { GameListComponent } from '../game-list/game-list.component';
import { LibraryBannersComponent } from '../library-banners/library-banners.component';
import { StartTipsComponent } from '../../start-tips/start-tips.component';
import { DeviceStore } from '../../../core/state/device.store';
import { DonateService } from '../../donate/donate.service';
import { PlatformBreadcrumbsComponent } from '../../platforms/platform-breadcrumbs/platform-breadcrumbs.component';
import { PlatformListComponent } from '../../platforms/platform-list/platform-list.component';
import { isBackKey, isTypingTarget } from '../../platforms/platforms.logic';
import { PlatformsService } from '../../platforms/platforms.service';
import { TourService } from '../../tour/tour.service';

/**
 * Central area: the platform list while a card is chosen without a platform; the game table with the breadcrumbs and
 * warnings; or the empty state when no games folder is chosen (with the useful tips below it while no SD card is
 * chosen either). Backspace or Esc outside a text field goes from a platform back to the platform list. Smart.
 */
@Component({
  selector: 'app-games-workspace',
  imports: [
    EmptyStateComponent, LibraryBannersComponent, GameListComponent, StartTipsComponent, PlatformListComponent, PlatformBreadcrumbsComponent,
  ],
  templateUrl: './games-workspace.component.html',
  styleUrl: './games-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class GamesWorkspaceComponent {
  protected readonly view = inject(LibraryViewService);
  protected readonly dialogs = inject(DialogStateService);
  protected readonly actions = inject(GameActionsService);
  protected readonly edits = inject(EntryEditService);
  protected readonly libraryStore = inject(LibraryStore);
  protected readonly preferences = inject(UiPreferencesService);
  protected readonly devices = inject(DeviceStore);

  protected readonly platforms = inject(PlatformsService);
  private readonly tour = inject(TourService);
  private readonly donate = inject(DonateService);

  readonly settings = input.required<PublicSettings>();
  /** The platform that was open last: its card gets the focus when the platform list comes back. */
  protected readonly previousPlatform = signal('');

  constructor() {
    effect(() => {
      const platform = this.settings().platform;
      if (platform) untracked(() => this.previousPlatform.set(platform));
    });
  }

  protected async choosePlatform(name: string): Promise<void> {
    if (this.actions.working()) return;
    await this.actions.selectPlatform(name);
  }

  /** Allowed while the library is being read (that only reads); not while a delete or a sync changes the files. */
  protected async backToPlatforms(): Promise<void> {
    if (this.actions.busy() || this.actions.syncing()) return;
    await this.actions.clearPlatform();
  }

  /** Backspace or Esc: back to the platform list, unless a field, a dialog, an edit or the tour has the key. */
  protected onKeydown(event: KeyboardEvent): void {
    const settings = this.settings();
    if (event.defaultPrevented || !isBackKey(event) || !settings.sdRoot || !settings.platform) return;
    if (isTypingTarget(event.target as HTMLElement | null) || isTypingTarget(document.activeElement as HTMLElement | null)) return;
    if (this.dialogs.anyOpen() || this.tour.visible() || this.donate.open() || this.edits.active()) return;
    event.preventDefault();
    void this.backToPlatforms();
  }

  protected startEdit(target: { rel: string; field: EditField }): void {
    const game = this.view.library()?.files.find((file) => file.rel === target.rel);
    if (game) this.edits.start(game, target.field);
  }
}
