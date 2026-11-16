import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PlatformCardItem } from '../platforms.logic';

/**
 * One platform on the main screen: the folder name, the full name and the number of games, on the colors of the
 * platform's default covers. A platform without games is dimmed. Presentational; the list moves the focus between the
 * cards (only the current card is in the tab order).
 */
@Component({
  selector: 'app-platform-card',
  imports: [TranslatePipe],
  templateUrl: './platform-card.component.html',
  styleUrl: './platform-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformCardComponent {
  readonly item = input.required<PlatformCardItem>();
  /** The card the Tab key reaches in the list. */
  readonly current = input(false);
  /** An operation is running: a click does nothing (the card stays focusable for the arrow keys). */
  readonly busy = input(false);

  readonly choose = output<string>();
  readonly focused = output<void>();

  /** The parts of the card read as one name ("SFC, Super Nintendo (SNES), 12 games"): the spans carry no spaces. */
  protected accessibleName(count: string): string {
    const { name, label } = this.item();
    return [name, label, count].filter(Boolean).join(', ');
  }

  protected click(): void {
    if (!this.busy()) this.choose.emit(this.item().name);
  }
}
