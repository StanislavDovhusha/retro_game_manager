import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ApiService } from '../../../core/api/api.service';
import { IconComponent } from '../icon/icon.component';

/** Game cover; a placeholder is shown when the game has no image. */
@Component({
  selector: 'app-game-thumb',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './game-thumb.component.html',
  styleUrl: './game-thumb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameThumbComponent {
  private readonly api = inject(ApiService);

  readonly rel = input.required<string>();
  readonly hasImage = input.required<boolean>();
  readonly version = input.required<number>();
  readonly size = input(32);

  protected readonly failed = signal(false);
  protected readonly iconSize = computed(() => Math.round(this.size() * 0.55));
  protected readonly url = computed(() => this.api.imageUrl(this.rel(), this.version()));

  constructor() {
    effect(() => {
      this.rel(); this.hasImage(); this.version();
      this.failed.set(false);
    });
  }
}
