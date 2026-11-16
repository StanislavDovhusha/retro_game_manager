import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Library, PublicSettings } from '@shared/models';
import { FormatService } from '../../../core/services/format.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { DonateIconComponent } from '../../donate/donate-icon/donate-icon.component';

/** Status line: library counters, last sync result and the log button. Presentational. */
@Component({
  selector: 'app-status-bar',
  imports: [IconComponent, DonateIconComponent, TranslatePipe],
  templateUrl: './status-bar.component.html',
  styleUrl: './status-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBarComponent {
  protected readonly fmt = inject(FormatService);
  private readonly i18n = inject(I18nService);

  readonly library = input.required<Library | null>();
  readonly settings = input.required<PublicSettings>();
  readonly shown = input.required<number>();
  readonly scanning = input(false);
  readonly syncing = input(false);
  /** The "Support the project" button reminds of itself now and then (until the popup has been opened). */
  readonly nudge = input(false);
  readonly toggleLog = output<void>();
  readonly support = output<void>();
  /** The tips window. */
  readonly tips = output<void>();

  protected readonly csvEntries = computed(() => {
    const library = this.library();
    return library?.csv.ok ? String(library.counts.csvEntries) : '—';
  });
  protected readonly syncFailed = computed(() => this.settings().lastSync?.ok === false);
  protected readonly syncError = computed(() => {
    const sync = this.settings().lastSync;
    return sync && !sync.ok ? sync.error : '';
  });
  protected readonly syncText = computed(() => {
    const sync = this.settings().lastSync;
    if (!sync) return this.i18n.t('statusBar.syncNever');
    if (sync.ok) return `${this.fmt.dateTime(sync.at)}: +${sync.toAdd} / −${sync.toRemove}`;
    return this.i18n.t('statusBar.syncError', { time: this.fmt.dateTime(sync.at) });
  });
}
