import { ChangeDetectionStrategy, Component, computed, inject, viewChild } from '@angular/core';
import { SettingsStore } from '../../../core/state/settings.store';
import { GameTreeComponent } from '../../games/game-tree/game-tree.component';
import { GameActionsService } from '../../library/game-actions.service';
import { LibraryViewService } from '../../library/library-view.service';
import { GameSearchService } from '../../search/game-search.service';
import { SearchResultsPanelComponent } from '../../search/search-results-panel/search-results-panel.component';

/**
 * "All games" panel: the folder tree of the games, or — after "Show all results" in the search field — every game of
 * the card that matches the search. It sits under the "Folders" block; the tab that opens it has the expand/collapse
 * buttons. Smart: reads the library view and search state.
 */
@Component({
  selector: 'app-games-panel',
  imports: [GameTreeComponent, SearchResultsPanelComponent],
  templateUrl: './games-panel.component.html',
  styleUrl: './games-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamesPanelComponent {
  protected readonly view = inject(LibraryViewService);
  protected readonly search = inject(GameSearchService);
  protected readonly actions = inject(GameActionsService);
  private readonly settings = inject(SettingsStore).settings;
  private readonly tree = viewChild.required(GameTreeComponent);

  protected readonly resultsShown = computed(() => this.search.showAll() && this.search.term() !== '');
  protected readonly selectedKey = computed(() => {
    const rel = this.view.selectedRel();
    return rel ? `${this.settings()?.platform ?? ''}/${rel}` : null;
  });

  expandAll(): void {
    this.tree().expandAll();
  }

  collapseAll(): void {
    this.tree().collapseAll();
  }
}
