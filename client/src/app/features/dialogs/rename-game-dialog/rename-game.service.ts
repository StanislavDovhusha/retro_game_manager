import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { RenameGameResponse, RenamePlanResponse } from '@shared/api';
import type { LibraryFile } from '@shared/models';
import { hasUnsupportedChars } from '@shared/gameName';
import { ApiService } from '../../../core/api/api.service';
import { toErrorMessage } from '../../../shared/utils/error.utils';
import { toCamelCase, toSafeFileName } from '../../../shared/utils/text.utils';

const PREVIEW_DELAY_MS = 400;

/** State and logic of the rename dialog: the preview is built by the server after the title is typed. */
@Injectable()
export class RenameGameService {
  private readonly api = inject(ApiService);

  private readonly game = signal<LibraryFile | null>(null);
  readonly title = signal('');
  readonly plan = signal<RenamePlanResponse | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  private sequence = 0;

  readonly fileBase = computed(() => toSafeFileName(this.title()));
  readonly shortName = computed(() => toCamelCase(this.title()));
  /**
   * Why the typed title cannot be used (a dictionary key), or null. An old title in another alphabet opens in the
   * field as it is and has to be changed to English letters before the game can be renamed.
   */
  readonly titleError = computed<string | null>(() => {
    const title = this.title().trim();
    if (hasUnsupportedChars(title)) return 'validation.latinOnly';
    if (!title) return 'validation.nameRequired';
    return null;
  });

  constructor() {
    // The preview is requested with a delay after typing; nothing is requested for the unchanged title.
    effect((onCleanup) => {
      const title = this.title();
      const game = this.game();
      if (!game) return;
      this.plan.set(null);
      this.error.set(null);
      if (!title.trim() || title.trim() === game.title || hasUnsupportedChars(title.trim())) {
        this.loading.set(false);
        return;
      }
      this.loading.set(true);
      const timer = setTimeout(() => { void this.loadPlan(game.rel, title); }, PREVIEW_DELAY_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  start(game: LibraryFile): void {
    this.game.set(game);
    this.title.set(game.title);
  }

  private async loadPlan(rel: string, title: string): Promise<void> {
    const sequence = ++this.sequence;
    try {
      const plan = await firstValueFrom(this.api.previewRename(rel, title));
      if (sequence !== this.sequence) return;
      this.plan.set(plan);
    } catch (e) {
      if (sequence !== this.sequence) return;
      this.error.set(toErrorMessage(e));
    } finally {
      if (sequence === this.sequence) this.loading.set(false);
    }
  }

  /** Renames the game; returns null (and sets `error`) when it did not work out. */
  async submit(): Promise<RenameGameResponse | null> {
    const game = this.game();
    if (!game || !this.plan() || this.titleError() || this.busy()) return null;
    this.busy.set(true);
    this.error.set(null);
    try {
      return await firstValueFrom(this.api.renameGame(game.rel, this.title()));
    } catch (e) {
      this.error.set(toErrorMessage(e));
      return null;
    } finally {
      this.busy.set(false);
    }
  }
}
