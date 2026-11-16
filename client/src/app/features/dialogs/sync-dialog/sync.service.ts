import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { SyncPreviewResponse } from '@shared/api';
import type { SyncReportOk } from '@shared/models';
import { ApiService } from '../../../core/api/api.service';
import { toErrorMessage } from '../../../shared/utils/error.utils';
import { GameActionsService } from '../../library/game-actions.service';

/** State and logic of the CSV sync dialog: preview first, then the real sync. */
@Injectable()
export class SyncService {
  private readonly api = inject(ApiService);
  private readonly actions = inject(GameActionsService);

  readonly preview = signal<SyncPreviewResponse | null>(null);
  readonly report = signal<SyncReportOk | null>(null);
  readonly error = signal<string | null>(null);
  readonly applying = signal(false);
  /** The CSV already matches the folder. */
  readonly upToDate = computed(() => {
    const preview = this.preview();
    // Creating the file or adding the tags column is a change too: the "Apply" button stays available for them.
    return preview !== null && preview.toAdd === 0 && preview.toRemove === 0 && !preview.created && preview.tagsColumnAdded === 0;
  });

  async loadPreview(): Promise<void> {
    try {
      this.preview.set(await firstValueFrom(this.api.previewSync()));
    } catch (e) {
      this.error.set(toErrorMessage(e));
    }
  }

  async apply(): Promise<void> {
    this.applying.set(true);
    this.actions.syncing.set(true);
    try {
      const report = await firstValueFrom(this.api.applySync());
      this.report.set(report);
      void this.actions.handleSyncDone(report);
    } catch (e) {
      this.error.set(toErrorMessage(e));
      this.actions.fail(e);
    } finally {
      this.applying.set(false);
      this.actions.syncing.set(false);
    }
  }
}
