import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LibraryStore } from '../../../core/state/library.store';
import { LogStore } from '../../../core/state/log.store';
import { SettingsStore } from '../../../core/state/settings.store';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ToastsComponent } from '../../../shared/components/toasts/toasts.component';
import { DialogHostComponent } from '../../dialogs/dialog-host/dialog-host.component';
import { DialogStateService } from '../../dialogs/dialog-state.service';
import { DonateService } from '../../donate/donate.service';
import { EmulatorService } from '../../emulator/emulator.service';
import { GameCardComponent } from '../../games/game-card/game-card.component';
import { GamesWorkspaceComponent } from '../../games/games-workspace/games-workspace.component';
import { AppHeaderComponent } from '../../header/app-header/app-header.component';
import { AppShellComponent } from '../../layout/app-shell/app-shell.component';
import { PanelLayoutService } from '../../layout/panel-layout.service';
import { UiPreferencesService } from '../../layout/ui-preferences.service';
import type { DeleteRequest } from '../../library/library.models';
import { GameActionsService } from '../../library/game-actions.service';
import { LibraryViewService } from '../../library/library-view.service';
import { FoldersPanelComponent } from '../../panels/folders-panel/folders-panel.component';
import { GlobalSearchComponent } from '../../search/global-search/global-search.component';
import { LogPanelComponent } from '../../status/log-panel/log-panel.component';
import { StatusBarComponent } from '../../status/status-bar/status-bar.component';
import { TourOverlayComponent } from '../../tour/tour-overlay/tour-overlay.component';
import { UpdateBannerComponent } from '../../update/update-banner/update-banner.component';
import { UpdateService } from '../../update/update.service';

/** The main screen: composes the header, the panels, the workspace and the dialogs. Smart: wires state to the presentational parts. */
@Component({
  selector: 'app-main-page',
  imports: [
    AppShellComponent, AppHeaderComponent, FoldersPanelComponent, GamesWorkspaceComponent, GameCardComponent,
    LogPanelComponent, StatusBarComponent, DialogHostComponent, ToastsComponent, IconComponent, TranslatePipe, GlobalSearchComponent,
    TourOverlayComponent, UpdateBannerComponent,
  ],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainPageComponent {
  protected readonly settingsStore = inject(SettingsStore);
  protected readonly updates = inject(UpdateService);
  protected readonly libraryStore = inject(LibraryStore);
  protected readonly view = inject(LibraryViewService);
  protected readonly actions = inject(GameActionsService);
  protected readonly panels = inject(PanelLayoutService);
  protected readonly preferences = inject(UiPreferencesService);
  protected readonly dialogs = inject(DialogStateService);
  protected readonly donate = inject(DonateService);
  protected readonly log = inject(LogStore);
  protected readonly emulator = inject(EmulatorService);

  private cardChecked = false;

  constructor() {
    void this.settingsStore.load();

    // Once the settings arrive the saved card is checked (a card that is gone is forgotten), then the scan starts; the
    // language and the panel state are taken from the settings once. The check runs in the background and gives up after
    // a few seconds, so the window is never held up by it.
    effect(() => {
      const settings = this.settingsStore.settings();
      if (!settings) return;
      untracked(() => {
        const language = this.preferences.applySaved(settings);
        if (this.cardChecked) return;
        this.cardChecked = true;
        void this.actions.verifySavedCard(language).finally(() => this.libraryStore.start());
      });
    });
  }

  /** Opens the delete confirmation for the selected game (its file or only its image). */
  protected requestDelete(kind: DeleteRequest['kind']): void {
    const game = this.view.selected();
    if (game) this.dialogs.requestDelete({ kind, game });
  }
}
