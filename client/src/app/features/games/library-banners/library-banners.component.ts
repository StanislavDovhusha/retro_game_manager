import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { Library } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** Warnings above the game table: missing folder, scan error, CSV error, unreadable folders. Presentational. */
@Component({
  selector: 'app-library-banners',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './library-banners.component.html',
  styleUrl: './library-banners.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryBannersComponent {
  readonly folderProblem = input<string | null>(null);
  readonly gamesDir = input('');
  readonly libraryError = input<string | null>(null);
  readonly library = input<Library | null>(null);
  readonly csvPath = input('');

  protected readonly csvError = computed(() => {
    const library = this.library();
    return library && this.csvPath() && !library.csv.ok ? library.csv.error : null;
  });
  protected readonly hasCsvProblem = computed(() => {
    const library = this.library();
    return Boolean(library && this.csvPath() && !library.csv.ok);
  });
  protected readonly readErrorCount = computed(() => this.library()?.errors.length ?? 0);
}
