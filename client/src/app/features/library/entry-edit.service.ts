import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { UpdateEntryResponse } from '@shared/api';
import type { LibraryFile } from '@shared/models';
import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { toErrorMessage } from '../../shared/utils/error.utils';
import { type ActiveEdit, type EditField, initialDraft, prepareEdit } from './entry-edit.logic';
import { GameActionsService } from './game-actions.service';
import { DonateService } from '../donate/donate.service';
import { LibraryViewService } from './library-view.service';

/** What starts the saving: Enter keeps the editor open when something is wrong, leaving the field cannot. */
export type CommitTrigger = 'enter' | 'blur';

/**
 * Editing of the title, the short name and the tags in the game table.
 * The state lives here, not in the row: the table is virtual, a row can leave the DOM and come back while the user scrolls.
 * Only one cell is edited at a time.
 */
@Injectable({ providedIn: 'root' })
export class EntryEditService {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly view = inject(LibraryViewService);
  private readonly actions = inject(GameActionsService);
  private readonly donate = inject(DonateService);

  readonly active = signal<ActiveEdit | null>(null);

  constructor() {
    // A game that disappeared from the library (a rescan after a change outside the app) cannot be edited any more.
    effect(() => {
      const library = this.view.library();
      untracked(() => {
        const edit = this.active();
        if (library && edit && !edit.saving && !library.files.some((game) => game.rel === edit.rel)) this.active.set(null);
      });
    });
  }

  /** Is this cell being edited right now? */
  isEditing(rel: string, field: EditField): boolean {
    const edit = this.active();
    return edit?.rel === rel && edit.field === field;
  }

  start(game: LibraryFile, field: EditField): void {
    const current = this.active();
    if (current?.saving) return; // the previous value is still being saved
    if (current?.rel === game.rel && current.field === field) return;
    this.active.set({ rel: game.rel, field, draft: initialDraft(game, field), error: null, saving: false });
  }

  setDraft(draft: string): void {
    this.active.update((edit) => (edit && !edit.saving ? { ...edit, draft, error: null } : edit));
  }

  /** Esc: the typed value is thrown away. */
  cancel(): void {
    if (this.active()?.saving) return;
    this.active.set(null);
  }

  async commit(trigger: CommitTrigger): Promise<void> {
    const edit = this.active();
    if (!edit || edit.saving) return;
    const game = this.view.library()?.files.find((file) => file.rel === edit.rel);
    if (!game) {
      this.active.set(null);
      return;
    }
    const prepared = prepareEdit(game, edit.field, edit.draft);
    if (prepared.kind === 'unchanged') {
      this.active.set(null);
      return;
    }
    if (prepared.kind === 'invalid') {
      this.fail(trigger, this.i18n.t(prepared.errorKey, prepared.params));
      return;
    }

    this.active.set({ ...edit, saving: true, error: null });
    try {
      const response = await firstValueFrom(this.api.updateEntry(prepared.request));
      this.active.set(null);
      await this.afterSaved(edit.rel, response);
      await this.donate.registerActions(1); // a title, short name or tags change is an action with the game
    } catch (e) {
      this.fail(trigger, toErrorMessage(e));
      void this.actions.reload(); // whatever the reason was, the table shows what is really on the card
    }
  }

  private fail(trigger: CommitTrigger, message: string): void {
    if (trigger === 'blur') {
      this.active.set(null);
      this.toasts.push('error', message);
      return;
    }
    this.active.update((edit) => (edit ? { ...edit, saving: false, error: message } : edit));
  }

  private async afterSaved(oldRel: string, response: UpdateEntryResponse): Promise<void> {
    const wasSelected = this.view.selectedRel() === oldRel;
    const wasChecked = this.view.checked().has(oldRel);
    await this.actions.reload();
    // A console list that could not be changed safely is an error the user has to see.
    response.listErrors?.forEach((error) => this.toasts.push('error', error));
    if (!response.renamed) return;
    // The rescan dropped the old path from the selection; the game is the same one under its new name.
    if (wasSelected) this.view.selectedRel.set(response.rel);
    if (wasChecked) this.view.setChecked([response.rel], true);
    this.toasts.push('success', this.i18n.t('toasts.gameRenamed', { title: response.title }));
    response.warnings.forEach((warning) => this.toasts.push('info', warning));
  }
}
