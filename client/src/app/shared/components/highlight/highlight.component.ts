import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

interface TextPart {
  text: string;
  match: boolean;
}

/** Highlights occurrences of a query in a text (case-insensitive). */
@Component({
  selector: 'app-highlight',
  templateUrl: './highlight.component.html',
  styleUrl: './highlight.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighlightComponent {
  readonly text = input.required<string>();
  readonly query = input('');

  protected readonly parts = computed<TextPart[]>(() => {
    const text = this.text();
    const query = this.query().trim();
    if (!query) return [{ text, match: false }];
    const lower = text.toLowerCase();
    const needle = query.toLowerCase();
    const parts: TextPart[] = [];
    let from = 0;
    for (;;) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      if (at > from) parts.push({ text: text.slice(from, at), match: false });
      parts.push({ text: text.slice(at, at + needle.length), match: true });
      from = at + needle.length;
    }
    parts.push({ text: text.slice(from), match: false });
    return parts;
  });
}
