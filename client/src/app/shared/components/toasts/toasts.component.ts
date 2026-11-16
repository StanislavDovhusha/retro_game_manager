import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastService, type ToastKind } from '../../../core/services/toast.service';
import { IconComponent } from '../icon/icon.component';
import type { IconName } from '../icon/icons';

const ICON: Record<ToastKind, IconName> = { success: 'check-circle', error: 'x-circle', info: 'info' };
const TONE: Record<ToastKind, string> = {
  success: 'border-emerald-500/50 text-emerald-700 dark:text-emerald-300',
  error: 'border-red-500/50 text-red-700 dark:text-red-300',
  info: 'border-shell-400/50',
};

/** Stack of notifications in the bottom right corner. */
@Component({
  selector: 'app-toasts',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './toasts.component.html',
  styleUrl: './toasts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastsComponent {
  protected readonly service = inject(ToastService);
  protected readonly toasts = this.service.toasts;
  protected readonly icon = ICON;
  protected readonly tone = TONE;
}
