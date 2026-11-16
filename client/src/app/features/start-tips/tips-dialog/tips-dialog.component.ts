import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DeviceStore } from '../../../core/state/device.store';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { StartTipsComponent } from '../start-tips.component';

/**
 * The tips window (the light-bulb button of the status bar): the same tips block as the start screen, for the console model
 * chosen in the settings. The modal closes by the cross, a click outside and Esc. Smart: reads the active profile.
 */
@Component({
  selector: 'app-tips-dialog',
  imports: [ModalComponent, StartTipsComponent, TranslatePipe],
  templateUrl: './tips-dialog.component.html',
  styleUrl: './tips-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TipsDialogComponent {
  protected readonly devices = inject(DeviceStore);
  readonly closed = output<void>();
}
