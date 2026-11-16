import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { SyncPreviewResponse } from '@shared/api';

const LIST_LIMIT = 200;

/** What the sync is going to change (nothing has been changed yet). Presentational. */
@Component({
  selector: 'app-sync-preview',
  imports: [TranslatePipe],
  templateUrl: './sync-preview.component.html',
  styleUrl: './sync-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SyncPreviewComponent {
  readonly preview = input.required<SyncPreviewResponse>();
  readonly upToDate = input(false);

  protected readonly addedShown = computed(() => this.preview().added.slice(0, LIST_LIMIT));
  protected readonly addedHidden = computed(() => Math.max(0, this.preview().added.length - LIST_LIMIT));
  protected readonly removedShown = computed(() => this.preview().removed.slice(0, LIST_LIMIT));
  protected readonly removedHidden = computed(() => Math.max(0, this.preview().removed.length - LIST_LIMIT));
}
