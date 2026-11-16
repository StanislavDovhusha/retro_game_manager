import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../../../shared/components/icon/icon.component';

/**
 * Desktop-style frame: a top bar, three columns and a status bar.
 * Slots: [top] [left] [center] [right] [drawer] [bottom].
 * The left column is always open (it holds "Folders" and "All games", see the folders panel); the right panel slides
 * away, its tab stays visible. Presentational.
 */
@Component({
  selector: 'app-shell',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  readonly rightHidden = input.required<boolean>();

  readonly rightPanelToggle = output<void>();

  protected readonly rightOpen = computed(() => !this.rightHidden());
}
