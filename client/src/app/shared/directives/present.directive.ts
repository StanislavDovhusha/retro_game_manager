import { Directive, type EmbeddedViewRef, TemplateRef, ViewContainerRef, effect, inject, input, untracked } from '@angular/core';

/** Template context: `*appPresent="value() as item"` (like `@if (value(); as item)`). */
export interface PresentContext<T> {
  $implicit: T;
  appPresent: T;
}

/** Class put on the root elements of the view while it leaves: the modal styles play the closing animation on it. */
export const LEAVING_CLASS = 'is-leaving';
/**
 * The closing animations the view waits for before it is removed: the `modal-*-out` keyframes of ModalComponent (Angular
 * prefixes the keyframe names of a component with its scope, hence no `^`). Other animations inside the window —
 * a spinning loader, say — are not waited for.
 */
const LEAVE_ANIMATION = /modal-[a-z]+-out$/;
/** Safety net: the view is removed after this long even when an animation never reports its end. */
const MAX_LEAVE_MS = 1000;

/**
 * `@if` for modal windows, with a closing animation: when the value becomes falsy the view is not removed at once —
 * the `is-leaving` class is put on its root elements, and the view leaves the DOM only when the closing animations
 * (`modal-*-out` keyframes of ModalComponent) have finished. Opening it again during the closing cancels it. Without
 * animations (prefers-reduced-motion) the view is removed at once.
 *
 * Usage: `<app-settings-dialog *appPresent="dialogs.settings()" … />`, `<app-x *appPresent="request() as request" [r]="request" />`.
 * While the view is leaving it keeps the last truthy value, so the window does not lose its content.
 */
@Directive({ selector: '[appPresent]' })
export class PresentDirective<T> {
  readonly appPresent = input.required<T>();

  private readonly container = inject(ViewContainerRef);
  private readonly template = inject<TemplateRef<PresentContext<T>>>(TemplateRef);
  private view: EmbeddedViewRef<PresentContext<T>> | null = null;
  /** Grows on every change: a closing that finishes after the window was opened again does nothing. */
  private generation = 0;

  static ngTemplateGuard_appPresent: 'binding';
  static ngTemplateContextGuard<T>(_dir: PresentDirective<T>, _ctx: unknown): _ctx is PresentContext<Exclude<T, false | 0 | '' | null | undefined>> {
    return true;
  }

  constructor() {
    effect(() => {
      const value = this.appPresent();
      untracked(() => this.update(value));
    });
  }

  private update(value: T): void {
    this.generation += 1;
    if (value) {
      if (!this.view) {
        this.view = this.container.createEmbeddedView(this.template, { $implicit: value, appPresent: value });
        return;
      }
      // Opened again (or a new value): a closing in progress is cancelled.
      this.view.context.$implicit = value;
      this.view.context.appPresent = value;
      for (const element of this.elements()) element.classList.remove(LEAVING_CLASS);
      this.view.markForCheck();
    } else if (this.view) {
      void this.leave(this.generation);
    }
  }

  private async leave(generation: number): Promise<void> {
    const elements = this.elements();
    for (const element of elements) element.classList.add(LEAVING_CLASS);
    // getAnimations() applies the new class first, so the closing animations it returns have already started.
    const closing = elements
      .flatMap((element) => element.getAnimations({ subtree: true }))
      .filter((animation) => LEAVE_ANIMATION.test(String((animation as Partial<CSSAnimation>).animationName ?? '')));
    if (closing.length) {
      await Promise.race([Promise.allSettled(closing.map((animation) => animation.finished)), new Promise((resolve) => setTimeout(resolve, MAX_LEAVE_MS))]);
    }
    if (generation !== this.generation || !this.view) return;
    this.container.clear();
    this.view = null;
  }

  private elements(): HTMLElement[] {
    return (this.view?.rootNodes ?? []).filter((node): node is HTMLElement => node instanceof HTMLElement);
  }
}
