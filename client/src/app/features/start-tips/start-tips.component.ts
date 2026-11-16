import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { DeviceProfile } from '@shared/devices';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { linkedText, pageLink, tipLinks } from './start-tips.links';

type TipId = 'sdCard' | 'firmware';

let instances = 0;

/**
 * Useful tips — on the start screen while no SD card is chosen, and in the tips window (the light-bulb button of the
 * status bar) at any time: an accordion of cards whose titles are visible at once and whose details open on a click. Presentational: the texts come from the dictionaries, the links from
 * start-tips.links.ts and from the console's profile.
 */
@Component({
  selector: 'app-start-tips',
  imports: [IconComponent, NgTemplateOutlet, TranslatePipe],
  templateUrl: './start-tips.component.html',
  styleUrl: './start-tips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StartTipsComponent {
  /** The console model chosen in the settings: its name and its firmware tip (none without a profile). */
  readonly device = input<DeviceProfile | null>(null);
  /** The "Useful tips" heading; off inside the tips window, whose title says it already. */
  readonly heading = input(true);
  /** Prefix of the element ids of this instance (unique on the page). */
  protected readonly uid = `start-tips-${++instances}`;

  protected readonly opened = signal<ReadonlySet<TipId>>(new Set());

  protected readonly links = {
    dumpWindows: tipLinks('win32DiskImager'),
    dumpMacLinux: tipLinks('applePiBaker'),
    recover: tipLinks('testDisk', 'photoRec'),
    format: tipLinks('sdCardFormatter'),
    restore: tipLinks('win32DiskImager', 'balenaEtcher'),
  };
  /** The name used in the texts: the model, or a neutral word when no profile is loaded. */
  protected readonly deviceName = computed(() => this.device()?.name ?? '');
  protected readonly firmware = computed(() => pageLink(this.device()?.tips.firmwareLink ?? ''));
  protected readonly community = computed(() => pageLink(this.device()?.tips.communityLink ?? ''));
  /** The firmware tip exists only when the profile gives at least one of its links. */
  protected readonly firmwareTip = computed(() => {
    const tips = this.device()?.tips;
    return tips && (this.firmware() || this.community()) ? tips : null;
  });
  /** A translated text with its `{{…Link}}` placeholders cut out, so that the links are drawn inside the sentence. */
  protected readonly linkedText = linkedText;

  protected isOpen(id: TipId): boolean {
    return this.opened().has(id);
  }

  protected toggle(id: TipId): void {
    this.opened.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
}
