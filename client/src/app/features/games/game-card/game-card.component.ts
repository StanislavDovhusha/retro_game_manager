import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LibraryFile } from '@shared/models';
import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FormatService } from '../../../core/services/format.service';
import { GameThumbComponent } from '../../../shared/components/game-thumb/game-thumb.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { EmulatorCard } from '../../emulator/emulator.service';

/** Details of the selected game with the actions on it. Presentational. */
@Component({
  selector: 'app-game-card',
  imports: [IconComponent, GameThumbComponent, TranslatePipe],
  templateUrl: './game-card.component.html',
  styleUrl: './game-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameCardComponent {
  protected readonly api = inject(ApiService);
  protected readonly fmt = inject(FormatService);
  private readonly i18n = inject(I18nService);

  readonly game = input.required<LibraryFile | null>();
  readonly csvReady = input.required<boolean>();
  readonly version = input.required<number>();
  readonly busy = input(false);
  /** "Play in emulator": null hides it (the web version). */
  readonly emulator = input<EmulatorCard | null>(null);

  readonly renameGame = output<void>();
  readonly chooseImage = output<void>();
  readonly deleteImage = output<void>();
  readonly deleteGame = output<void>();
  readonly play = output<void>();

  protected readonly imageText = computed(() => {
    const game = this.game();
    if (!game) return '';
    if (!game.hasImage) return this.i18n.t('gameCard.image.none');
    const source = game.imageSource === 'manual' ? this.i18n.t('gameCard.image.manual') : this.i18n.t('gameCard.image.auto');
    return `${game.imageName} (${source})`;
  });
}
