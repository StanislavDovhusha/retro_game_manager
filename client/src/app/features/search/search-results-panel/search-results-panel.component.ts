import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { SearchGame } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { VirtualListComponent } from '../../../shared/components/virtual-list/virtual-list.component';
import { SearchResultComponent } from '../search-result/search-result.component';

const ROW_HEIGHT = 48;

/**
 * Every game of the card that matches the search ("Show all results"): shown in the "All games" panel in place of the
 * folder tree. A click opens the platform of the game and selects it in the table. Presentational.
 */
@Component({
  selector: 'app-search-results-panel',
  imports: [IconComponent, TranslatePipe, VirtualListComponent, SearchResultComponent],
  templateUrl: './search-results-panel.component.html',
  styleUrl: './search-results-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsPanelComponent {
  readonly results = input.required<readonly SearchGame[]>();
  readonly term = input.required<string>();
  readonly loading = input(false);
  /** `platform/rel` of the game selected in the table. */
  readonly selectedKey = input<string | null>(null);

  readonly openResult = output<SearchGame>();
  readonly closed = output<void>();

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly keyOf = (game: SearchGame): string => `${game.platform}/${game.rel}`;
  protected readonly itemKey = (index: number): string => {
    const game = this.results()[index];
    return game ? this.keyOf(game) : String(index);
  };
}
