import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The "Support the project" icon: a cup of coffee that turns into a mug of beer and back (a crossfade every 4 s).
 * Steam rises over the coffee; bubbles rise in the beer and its foam sways. Drawn as SVG in `currentColor`, so it
 * follows the text colour of the light and dark themes and looks the same on every system (no emoji). With
 * `prefers-reduced-motion` it is a still cup of coffee. Presentational and decorative (`aria-hidden`): the button or
 * heading next to it carries the text.
 */
@Component({
  selector: 'app-donate-icon',
  templateUrl: './donate-icon.component.html',
  styleUrl: './donate-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
})
export class DonateIconComponent {
  /** Width and height in px. */
  readonly size = input(16);
}
