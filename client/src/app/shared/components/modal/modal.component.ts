import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { IconComponent } from '../icon/icon.component';

/**
 * Modal window. The content is the main slot; buttons go through `<div footer>…</div>`.
 * Closes on Esc and on a click on the backdrop.
 */
@Component({
  selector: 'app-modal',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ModalComponent {
  readonly title = input.required<string>();
  readonly wide = input(false);
  readonly full = input(false);
  readonly closed = output<void>();

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}
