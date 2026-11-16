import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SettingsStore } from '../../../core/state/settings.store';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { inputValue } from '../../../shared/utils/dom.utils';
import { GameActionsService } from '../../library/game-actions.service';
import { SdCardService } from '../sd-card.service';
import { SdCardTreeComponent } from '../sd-card-tree/sd-card-tree.component';
import { DeviceStore } from '../../../core/state/device.store';

/** "SD card" block: card root, platform choice and the card contents. Smart: works with the services. */
@Component({
  selector: 'app-sd-card-panel',
  imports: [IconComponent, TranslatePipe, SdCardTreeComponent],
  templateUrl: './sd-card-panel.component.html',
  styleUrl: './sd-card-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SdCardPanelComponent {
  protected readonly card = inject(SdCardService);
  protected readonly devices = inject(DeviceStore);
  private readonly actions = inject(GameActionsService);
  protected readonly settings = inject(SettingsStore).settings;

  protected readonly val = inputValue;
  protected readonly selecting = signal(false);
  protected readonly busy = computed(() => this.actions.working() || this.selecting());

  protected async choose(name: string): Promise<void> {
    if (!name || this.busy()) return;
    this.selecting.set(true);
    try { await this.actions.selectPlatform(name); } finally { this.selecting.set(false); }
  }
}
