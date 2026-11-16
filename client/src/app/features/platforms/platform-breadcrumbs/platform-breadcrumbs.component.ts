import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** "All platforms › Super Nintendo" above the game table; the first part goes back to the platform list. Presentational. */
@Component({
  selector: 'app-platform-breadcrumbs',
  imports: [TranslatePipe],
  templateUrl: './platform-breadcrumbs.component.html',
  styleUrl: './platform-breadcrumbs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformBreadcrumbsComponent {
  /** The full name of the open platform. */
  readonly title = input.required<string>();
  /** Its folder name, shown after the full name when they differ. */
  readonly folder = input('');
  readonly busy = input(false);

  readonly allPlatforms = output<void>();
}
