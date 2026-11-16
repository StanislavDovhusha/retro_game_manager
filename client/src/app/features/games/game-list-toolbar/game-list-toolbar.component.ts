import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** Selection toolbar above the game table: select all, counters, folder filter and bulk delete. Presentational. */
@Component({
  selector: 'app-game-list-toolbar',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './game-list-toolbar.component.html',
  styleUrl: './game-list-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameListToolbarComponent {
  readonly hasGames = input.required<boolean>();
  readonly allChecked = input.required<boolean>();
  /** Some (but not all) of the shown games are checked. */
  readonly partiallyChecked = input.required<boolean>();
  readonly checkedCount = input.required<number>();
  /** Checked games hidden by the current filter. */
  readonly hiddenCount = input.required<number>();
  readonly selectedDir = input<string | null>(null);

  readonly toggleAll = output<void>();
  readonly clearDir = output<void>();
  readonly clearChecked = output<void>();
  readonly deleteChecked = output<void>();

  private readonly master = viewChild<ElementRef<HTMLInputElement>>('master');

  constructor() {
    // The "select all" checkbox is indeterminate when only part of the games is checked.
    effect(() => {
      const partial = this.partiallyChecked();
      const el = this.master()?.nativeElement;
      if (el) el.indeterminate = partial;
    });
  }
}
