import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SettingsStore } from '../../../core/state/settings.store';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PanelLayoutService } from '../../layout/panel-layout.service';
import { KEY_STEP, MAX_SHARE, MIN_FOLDERS_HEIGHT, MIN_GAMES_HEIGHT, MIN_SHARE, shareAfterMove } from '../../layout/split.logic';
import { LibraryViewService } from '../../library/library-view.service';
import { SdCardPanelComponent } from '../../sd-card/sd-card-panel/sd-card-panel.component';
import { GamesPanelComponent } from '../games-panel/games-panel.component';

/**
 * The left column: the "Folders" block (the SD card and the games folder), under it the "All games" panel.
 * A horizontal tab between them opens and closes "All games"; while it is open a splitter above the tab changes
 * how the height is shared. Both blocks keep a minimum height. Smart: the state lives in PanelLayoutService.
 */
@Component({
  selector: 'app-folders-panel',
  imports: [TranslatePipe, IconComponent, SdCardPanelComponent, GamesPanelComponent],
  templateUrl: './folders-panel.component.html',
  styleUrl: './folders-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoldersPanelComponent {
  protected readonly settings = inject(SettingsStore).settings;
  protected readonly layout = inject(PanelLayoutService);
  protected readonly view = inject(LibraryViewService);

  protected readonly minFolders = MIN_FOLDERS_HEIGHT;
  protected readonly minGames = MIN_GAMES_HEIGHT;
  protected readonly minPercent = Math.round(MIN_SHARE * 100);
  protected readonly maxPercent = Math.round(MAX_SHARE * 100);
  protected readonly dragging = signal(false);

  private readonly foldersBlock = viewChild.required<ElementRef<HTMLElement>>('foldersBlock');
  private readonly gamesBlock = viewChild.required<ElementRef<HTMLElement>>('gamesBlock');
  private readonly gamesPanel = viewChild.required(GamesPanelComponent);
  private drag: { startY: number; folders: number; total: number } | null = null;

  /** Flex values of the two blocks: the free height is shared in proportion; the Folders block takes everything when "All games" is closed. */
  protected readonly foldersFlex = computed(() => {
    if (!this.layout.gamesOpen()) return '1 1 0px';
    const share = this.layout.foldersShare();
    return `${share} 1 0px`;
  });
  protected readonly gamesFlex = computed(() => `${1 - this.layout.foldersShare()} 1 0px`);
  protected readonly percent = computed(() => Math.round(this.layout.foldersShare() * 100));

  protected expandAll(): void {
    this.gamesPanel().expandAll();
  }

  protected collapseAll(): void {
    this.gamesPanel().collapseAll();
  }

  /** Heights of the two blocks right now (px). */
  private measure(): { folders: number; total: number } {
    const folders = this.foldersBlock().nativeElement.getBoundingClientRect().height;
    const games = this.gamesBlock().nativeElement.getBoundingClientRect().height;
    return { folders, total: folders + games };
  }

  protected onSplitDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const { folders, total } = this.measure();
    this.drag = { startY: event.clientY, folders, total };
    this.dragging.set(true);
  }

  protected onSplitMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;
    this.layout.moveSplit(shareAfterMove(drag.folders, event.clientY - drag.startY, drag.total));
  }

  protected onSplitUp(): void {
    if (!this.drag) return;
    this.drag = null;
    this.dragging.set(false);
    this.layout.commitSplit();
  }

  protected onSplitKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const { folders, total } = this.measure();
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.layout.moveSplit(shareAfterMove(folders, event.key === 'ArrowUp' ? -step : step, total));
      this.layout.commitSplit();
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.layout.moveSplit(shareAfterMove(folders, -total, total)); // as small as the minimum allows
      this.layout.commitSplit();
    } else if (event.key === 'End') {
      event.preventDefault();
      this.layout.moveSplit(shareAfterMove(folders, total, total));
      this.layout.commitSplit();
    }
  }
}
