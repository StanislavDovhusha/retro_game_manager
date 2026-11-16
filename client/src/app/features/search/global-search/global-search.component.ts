import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { SearchGame } from '@shared/models';
import { SearchBoxComponent } from '../../header/search-box/search-box.component';
import { PanelLayoutService } from '../../layout/panel-layout.service';
import { GameActionsService } from '../../library/game-actions.service';
import { LibraryViewService } from '../../library/library-view.service';
import { GameSearchService } from '../game-search.service';

/**
 * The search field of the header wired to the state: the query filters the open folder and searches every platform
 * folder of the card; a result opens its platform and selects the game, "Show all results" fills the "All games" panel.
 * Smart: it is projected into the (presentational) header by the main page.
 */
@Component({
  selector: 'app-global-search',
  imports: [SearchBoxComponent],
  template: `
    <app-search-box [query]="view.query()" [scope]="view.scope()" [resultCount]="view.listed().length" [term]="search.term()"
      [results]="search.top()" [total]="search.results().length" [loading]="search.loading()" [error]="search.error()"
      [unreadable]="search.unreadable()" (queryChange)="view.query.set($event)" (scopeChange)="view.scope.set($event)"
      (openResult)="open($event)" (showAll)="showAll()" />
  `,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalSearchComponent {
  protected readonly search = inject(GameSearchService);
  protected readonly view = inject(LibraryViewService);
  private readonly actions = inject(GameActionsService);
  private readonly layout = inject(PanelLayoutService);

  protected open(game: SearchGame): void {
    void this.actions.revealGame(game);
  }

  protected showAll(): void {
    this.search.showAll.set(true);
    if (!this.layout.gamesOpen()) this.layout.toggleGames();
  }
}
