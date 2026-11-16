import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';
import { LatinInputDirective } from '../../../shared/directives/latin-input.directive';
import { inputValue } from '../../../shared/utils/dom.utils';

let nextId = 0;

/** Where the saving was started from: Enter, or the field losing the focus. */
export type InlineCommit = 'enter' | 'blur';

/**
 * A text field that replaces the content of a table cell while it is edited.
 * Enter or leaving the field saves, Esc cancels. A note (hint) and the reason why the value was refused (error)
 * float under the field, so the fixed row height does not change. Presentational.
 */
@Component({
  selector: 'app-inline-input',
  imports: [LatinInputDirective],
  templateUrl: './inline-input.component.html',
  styleUrl: './inline-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InlineInputComponent {
  readonly value = input.required<string>();
  /** Accessible name of the field. */
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly saving = input(false);
  readonly mono = input(false);
  /** A title or short name: only English letters, digits, spaces, hyphens, underscores and brackets can be typed. */
  readonly latin = input(false);

  readonly draftChange = output<string>();
  readonly commit = output<InlineCommit>();
  readonly cancel = output<void>();

  protected readonly val = inputValue;
  protected readonly noteId = `inline-input-note-${nextId++}`;
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  /** Esc removes the field, which also makes it lose the focus: that must not save. */
  private cancelled = false;

  constructor() {
    afterNextRender(() => {
      const el = this.field().nativeElement;
      el.focus({ preventScroll: true });
      el.select();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.isComposing) return; // Enter that confirms an IME composition is not "save"
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commit.emit('enter');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelled = true;
      this.cancel.emit();
    }
  }

  protected onBlur(): void {
    if (this.cancelled || this.saving()) return;
    this.commit.emit('blur');
  }
}
