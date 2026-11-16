import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Lang, Theme } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';

/**
 * Top bar of the application: SD card, add game, search, scan/sync, language, theme and settings. Presentational:
 * the search field is projected into the `[search]` slot by the page.
 */
@Component({
  selector: 'app-header',
  imports: [IconComponent, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  readonly gamesDir = input.required<string>();
  readonly sdRoot = input.required<string>();
  readonly scanning = input(false);
  readonly syncing = input(false);
  readonly theme = input.required<Theme>();
  readonly lang = input.required<Lang>();

  readonly selectSdCard = output<void>();
  readonly addGame = output<void>();
  readonly scan = output<void>();
  readonly sync = output<void>();
  readonly openSettings = output<void>();
  readonly toggleTheme = output<void>();
  readonly languageChange = output<Lang>();
}
