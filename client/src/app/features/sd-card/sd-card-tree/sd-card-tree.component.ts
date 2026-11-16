import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { SdNode } from '@shared/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { IconName } from '../../../shared/components/icon/icons';
import type { SdRow } from '../sd-card.models';

/** Folder tree of the SD card (a flat list of visible rows). Platform folders can be chosen. Presentational. */
@Component({
  selector: 'app-sd-card-tree',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './sd-card-tree.component.html',
  styleUrl: './sd-card-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SdCardTreeComponent {
  private readonly i18n = inject(I18nService);

  readonly rows = input.required<SdRow[]>();
  /** Name of the selected platform. */
  readonly platform = input.required<string>();
  readonly busy = input(false);

  readonly toggleNode = output<string>();
  readonly choosePlatform = output<string>();

  protected isCurrent(node: SdNode): boolean {
    return node.kind === 'platform' && node.name === this.platform();
  }

  /** The full name of a platform folder in the console's profile (`SFC` → Super Nintendo (SNES)); null for other folders. */
  protected platformName(node: SdNode): string | null {
    return node.kind === 'platform' ? node.label : null;
  }

  protected nodeIcon(node: SdNode): IconName {
    return node.kind === 'system' ? 'lock' : node.kind === 'platform' ? 'gamepad' : 'folder';
  }

  protected nodeTitle(node: SdNode): string {
    if (node.kind === 'system') return this.i18n.t('sdCard.systemFolder');
    if (node.kind === 'media') return this.i18n.t('sdCard.notGameFolder');
    if (node.kind === 'platform') {
      const fullName = node.label;
      return this.i18n.t('sdCard.selectPlatform', { name: fullName ? `${node.name} — ${fullName}` : node.name });
    }
    return node.rel;
  }

  protected rowKey(row: SdRow): string {
    return row.kind === 'node' ? `n:${row.node.rel}` : row.key;
  }
}
