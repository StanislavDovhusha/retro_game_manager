import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LogLevel } from '@shared/models';
import { FormatService } from '../../../core/services/format.service';
import { LogStore } from '../../../core/state/log.store';
import { IconComponent } from '../../../shared/components/icon/icon.component';

const TONE: Record<LogLevel, string> = {
  info: 'text-shell-500 dark:text-shell-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
};

/** Operation log drawer at the bottom of the window. */
@Component({
  selector: 'app-log-panel',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './log-panel.component.html',
  styleUrl: './log-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogPanelComponent {
  protected readonly log = inject(LogStore);
  protected readonly fmt = inject(FormatService);
  protected readonly tone = TONE;

  constructor() {
    effect(() => {
      this.log.refreshKey();
      void this.log.load();
    });
  }
}
