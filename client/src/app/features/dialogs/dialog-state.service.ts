import { Injectable, computed, signal } from '@angular/core';
import type { DeleteRequest } from '../library/library.models';

/** Which dialogs are open. Panels open a dialog through this service, the dialog host renders them. */
@Injectable({ providedIn: 'root' })
export class DialogStateService {
  readonly settings = signal(false);
  readonly sync = signal(false);
  readonly addGame = signal(false);
  readonly renameGame = signal(false);
  readonly libraryPaths = signal(false);
  readonly deleteMany = signal(false);
  readonly deleteRequest = signal<DeleteRequest | null>(null);
  /** The tips window (the light-bulb button of the status bar). */
  readonly tips = signal(false);

  /** Any of the dialogs is open. */
  readonly anyOpen = computed(
    () => this.settings() || this.sync() || this.addGame() || this.renameGame() || this.libraryPaths() || this.deleteMany() || this.deleteRequest() !== null || this.tips(),
  );

  requestDelete(request: DeleteRequest): void {
    this.deleteRequest.set(request);
  }
}
