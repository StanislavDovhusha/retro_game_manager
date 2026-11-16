import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SearchGame } from '@shared/models';
import { searchKey } from '@shared/search';
import { HighlightComponent } from '../../../shared/components/highlight/highlight.component';

/**
 * One game found by the global search: the title, the platform (folder and full name) and the tags, with the query
 * highlighted. When the match is not in the title, the short title or the file name that matched is shown too.
 * Used by the drop-down list of the header and by the full list in the "All games" panel. Presentational.
 */
@Component({
  selector: 'app-search-result',
  imports: [HighlightComponent],
  templateUrl: './search-result.component.html',
  styleUrl: './search-result.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultComponent {
  readonly game = input.required<SearchGame>();
  readonly term = input.required<string>();

  protected readonly fullName = computed(() => this.game().platformName);
  /** The short title or the file name, when that is where the query was found. */
  protected readonly alsoMatched = computed(() => {
    const game = this.game();
    const key = searchKey(this.term());
    if (!key || game.title.toLowerCase().includes(key)) return null;
    if (game.short.toLowerCase().includes(key)) return game.short;
    if (game.fileName.toLowerCase().includes(key)) return game.fileName;
    return null;
  });
}
