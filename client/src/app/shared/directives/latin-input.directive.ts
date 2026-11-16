import { DestroyRef, Directive, ElementRef, booleanAttribute, inject, input } from '@angular/core';
import { stripUnsupportedChars } from '@shared/gameName';
import { I18nService } from '../../core/i18n/i18n.service';

/** How long the note under the field stays. */
const HINT_MS = 2500;

/**
 * A field for a game title or short name: only English letters, digits, spaces, hyphens, underscores and brackets
 * (`@shared/gameName`). What else is typed, pasted or dropped is removed at once (accents are dropped from letters:
 * é → e), and a short note under the field says why. It runs before the field's own `(input)` handler, so the
 * component only ever sees the cleaned text. An IME composition (Japanese, Chinese…) is cleaned when it ends.
 *
 * `appLatinInput="false"` turns it off (the same inline field is used for tags).
 */
@Directive({ selector: 'input[appLatinInput]' })
export class LatinInputDirective {
  private readonly field = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private readonly i18n = inject(I18nService);

  readonly enabled = input(true, { alias: 'appLatinInput', transform: booleanAttribute });

  private hint: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // A capturing listener on the field runs before the bubbling `(input)` binding of the template.
    const onInput = (event: Event): void => {
      if (this.enabled() && !(event as InputEvent).isComposing) this.clean();
    };
    // The composition ends after its last input event: clean then, and tell the template about the new value.
    const onCompositionEnd = (): void => {
      if (this.enabled() && this.clean()) this.field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    this.field.addEventListener('input', onInput, { capture: true });
    this.field.addEventListener('compositionend', onCompositionEnd);
    inject(DestroyRef).onDestroy(() => {
      this.field.removeEventListener('input', onInput, { capture: true });
      this.field.removeEventListener('compositionend', onCompositionEnd);
      this.hideHint();
    });
  }

  /** Removes what is not allowed, keeping the caret in place; true when something was removed. */
  private clean(): boolean {
    const value = this.field.value;
    const next = stripUnsupportedChars(value);
    if (next === value) return false;
    const caret = stripUnsupportedChars(value.slice(0, this.field.selectionStart ?? value.length)).length;
    this.field.value = next;
    this.field.setSelectionRange(caret, caret);
    this.showHint();
    return true;
  }

  /** The note under the field (in the page body, so a table cell or a dialog does not clip it); read by screen readers. */
  private showHint(): void {
    clearTimeout(this.timer);
    this.hint ??= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'latin-hint' }));
    this.hint.setAttribute('role', 'status');
    this.hint.textContent = this.i18n.t('validation.latinOnly');
    const box = this.field.getBoundingClientRect();
    this.hint.style.left = `${Math.max(4, Math.min(box.left, window.innerWidth - 324))}px`;
    this.hint.style.top = `${box.bottom + 4}px`;
    this.timer = setTimeout(() => this.hideHint(), HINT_MS);
  }

  private hideHint(): void {
    clearTimeout(this.timer);
    this.hint?.remove();
    this.hint = null;
  }
}
