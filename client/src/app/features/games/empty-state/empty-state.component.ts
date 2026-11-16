import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/** Shown while no games folder is chosen. Presentational. */
@Component({
  selector: 'app-empty-state',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly selectGamesFolder = output<void>();
  readonly selectSdCard = output<void>();
}
