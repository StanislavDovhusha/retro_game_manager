import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type { LibraryFile } from '@shared/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { LibraryStore } from '../../core/state/library.store';
import { GameSearchService } from '../search/game-search.service';
import type { SearchScope, SortKey, SortState } from '../../shared/models/ui.models';
import { buildTree, isInDir, matchGame } from '../../shared/utils/filter.utils';
import { sortGames } from '../../shared/utils/sort.utils';

/** View state of the library: filter, selection, sorting and everything derived from them. */
@Injectable({ providedIn: 'root' })
export class LibraryViewService {
  private readonly libraryStore = inject(LibraryStore);
  private readonly i18n = inject(I18nService);

  private readonly search = inject(GameSearchService);

  readonly library = this.libraryStore.library;
  /** Text of the search field in the header (as typed). The field searches every platform folder (see GameSearchService) and filters this one. */
  readonly query = this.search.query;
  /** The query the filter applies: the same 300 ms pause after the last key press as the global search. */
  readonly term = this.search.term;
  readonly scope = signal<SearchScope>('all');
  readonly selectedRel = signal<string | null>(null);
  readonly selectedDir = signal<string | null>(null);
  readonly sort = signal<SortState>({ key: 'name', dir: 'asc' });
  readonly checked = signal<ReadonlySet<string>>(new Set());

  private readonly files = computed<LibraryFile[]>(() => this.library()?.files ?? []);
  /** Changes on every scan: covers are reloaded. */
  readonly version = computed(() => this.library()?.scannedAt ?? 0);
  readonly csvReady = computed(() => Boolean(this.library()?.csv.ok));
  readonly tree = computed(() => buildTree(this.files(), this.library()?.dirs ?? []));
  private readonly filtering = computed(() => this.term().length > 0);
  readonly matching = computed(() => this.files().filter((game) => matchGame(game, this.term(), this.scope())));
  /** Relative paths of the games that match the filter; null when no filter is set. */
  readonly visible = computed<ReadonlySet<string> | null>(() => (this.filtering() ? new Set(this.matching().map((game) => game.rel)) : null));
  readonly listed = computed(() => this.matching().filter((game) => isInDir(game, this.selectedDir())));
  readonly sorted = computed(() => sortGames(this.listed(), this.sort(), this.i18n.locale()));
  readonly selected = computed(() => this.files().find((game) => game.rel === this.selectedRel()) ?? null);
  readonly checkedGames = computed(() => this.files().filter((game) => this.checked().has(game.rel)));
  readonly folderProblem = computed(() => {
    const library = this.library();
    return library && !library.gamesDir.exists ? library.gamesDir.error : null;
  });

  constructor() {
    // If the selected game/folder disappeared after a refresh, the selection is reset.
    effect(() => {
      const library = this.library();
      if (!library) return;
      untracked(() => {
        const previous = this.checked();
        if (previous.size > 0) {
          const existing = new Set(library.files.map((game) => game.rel));
          const next = new Set([...previous].filter((rel) => existing.has(rel)));
          if (next.size !== previous.size) this.checked.set(next);
        }
        const rel = this.selectedRel();
        if (rel && !library.files.some((game) => game.rel === rel)) this.selectedRel.set(null);
        const dir = this.selectedDir();
        if (dir && !library.dirs.includes(dir)) this.selectedDir.set(null);
      });
    });
  }

  changeSort(key: SortKey): void {
    this.sort.update((state) => (state.key === key ? { key, dir: state.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  setChecked(rels: string[], value: boolean): void {
    const next = new Set(this.checked());
    rels.forEach((rel) => (value ? next.add(rel) : next.delete(rel)));
    this.checked.set(next);
  }

  clearChecked(): void {
    this.checked.set(new Set());
  }

  /** Resets the selection, the checked games and (optionally) the filter. */
  resetSelection(options: { query?: boolean } = {}): void {
    this.clearChecked();
    this.selectedRel.set(null);
    this.selectedDir.set(null);
    if (options.query) this.query.set('');
  }
}
