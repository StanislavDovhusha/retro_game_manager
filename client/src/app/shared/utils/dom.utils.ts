/** Value of an input element taken from an event (for templates without FormsModule). */
export const inputValue = (e: Event): string => (e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;

export const inputChecked = (e: Event): boolean => (e.target as HTMLInputElement).checked;

/** The system asks for less motion: animations are skipped. */
export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
