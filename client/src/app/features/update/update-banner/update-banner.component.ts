import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { UpdateRelease } from '@shared/api';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/**
 * "Version 1.0.1 is available": a strip at the very top of the window. It takes its own height and pushes the
 * interface down (it never covers it), unfolding and folding with an animation (none under prefers-reduced-motion).
 * "Download" opens the release page in the system browser (in a new tab in the browser version). Presentational.
 */
@Component({
  selector: 'app-update-banner',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './update-banner.component.html',
  styleUrl: './update-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpdateBannerComponent {
  /** The release to announce; null folds the strip away. */
  readonly release = input<UpdateRelease | null>(null);
  readonly dismiss = output<void>();

  protected readonly open = computed(() => this.release() !== null);
  /** The text stays while the strip folds away. */
  protected readonly shown = linkedSignal<UpdateRelease | null, UpdateRelease | null>({
    source: this.release,
    computation: (release, previous) => release ?? previous?.value ?? null,
  });
  /** The release title, when it says more than the version. */
  protected readonly title = computed(() => {
    const release = this.shown();
    if (!release?.name) return '';
    const plain = release.name.replace(/^v/i, '').trim();
    return plain === release.version ? '' : release.name;
  });
}
