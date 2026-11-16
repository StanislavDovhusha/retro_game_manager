import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { SearchGame, SearchIndex } from '@shared/models';
import { SEARCH_DEBOUNCE_MS, SEARCH_DROPDOWN_LIMIT, searchGames } from '@shared/search';
import { ApiService } from '../../core/api/api.service';
import { LibraryStore } from '../../core/state/library.store';
import { SettingsStore } from '../../core/state/settings.store';
import { toErrorMessage } from '../../shared/utils/error.utils';

/**
 * The search field of the header. One query drives two searches with the same rules (`@shared/search`): the filter of
 * the open platform folder (LibraryViewService) and the global search over every platform folder of the card, whose
 * results drop down under the field and fill the "All games" panel on "Show all results".
 *
 * The global search works on an index of the card that the server builds (`GET /api/search/index`). It is kept here
 * and fetched again, in the background, only when it is needed: the first search, and a search after the library
 * was rescanned (a game added, renamed or deleted, a CSV synced, the window focused again) or another card was chosen.
 */
@Injectable({ providedIn: 'root' })
export class GameSearchService {
  private readonly api = inject(ApiService);
  private readonly libraryStore = inject(LibraryStore);
  private readonly settingsStore = inject(SettingsStore);

  /** Text of the search field, as typed. */
  readonly query = signal('');
  /** The query the searches run with: follows `query` after a pause in typing; clearing the field applies at once. */
  readonly term = signal('');
  readonly index = signal<SearchIndex | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** The "All games" panel shows the full result list instead of the folder tree. */
  readonly showAll = signal(false);

  /** Every game of the card that matches, the most relevant first. */
  readonly results = computed<SearchGame[]>(() => searchGames(this.index()?.games ?? [], this.term()));
  /** What the drop-down list shows. */
  readonly top = computed(() => this.results().slice(0, SEARCH_DROPDOWN_LIMIT));
  /** Platform folders that could not be read (their games may be missing from the results). */
  readonly unreadable = computed(() => [...new Set((this.index()?.errors ?? []).map((error) => error.folder).filter(Boolean))]);

  private readonly sdRoot = computed(() => this.settingsStore.settings()?.sdRoot ?? '');
  private stale = true;
  private running: Promise<void> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const query = this.query();
      untracked(() => this.debounce(query));
    });
    effect(() => {
      const term = this.term();
      untracked(() => {
        if (!term) {
          this.showAll.set(false);
          return;
        }
        if (this.stale || !this.index()) void this.refresh();
      });
    });
    // The library was rescanned or the card changed: the index is out of date. While a search is on screen it is
    // fetched again at once (the old results stay until the new ones arrive); otherwise with the next search.
    effect(() => {
      this.libraryStore.library();
      this.sdRoot();
      untracked(() => {
        this.stale = true;
        if (this.term()) void this.refresh();
      });
    });
  }

  /** Forgets the index of a card that is no longer selected, and the query with it. */
  reset(): void {
    this.query.set('');
    this.term.set('');
    this.index.set(null);
    this.error.set(null);
    this.stale = true;
  }

  /** Clears the field and closes the result list. */
  clear(): void {
    this.query.set('');
  }

  private debounce(query: string): void {
    clearTimeout(this.timer);
    const term = query.trim();
    if (!term) {
      this.term.set('');
      return;
    }
    this.timer = setTimeout(() => this.term.set(term), SEARCH_DEBOUNCE_MS);
  }

  /** Fetches the index. A call made while a fetch is running is served by one more fetch after it. */
  private refresh(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.stale = false;
    this.loading.set(true);
    this.running = (async () => {
      try {
        this.index.set(await firstValueFrom(this.api.searchIndex()));
        this.error.set(null);
      } catch (e) {
        this.error.set(toErrorMessage(e));
        this.stale = true;
      } finally {
        this.loading.set(false);
        this.running = null;
      }
      if (this.again) {
        this.again = false;
        await this.refresh();
      }
    })();
    return this.running;
  }
}
