import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { ICONS, type IconName } from './icons';

/** Inline SVG icon from the built-in icon set. */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(16);

  protected readonly html = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()]));
}
