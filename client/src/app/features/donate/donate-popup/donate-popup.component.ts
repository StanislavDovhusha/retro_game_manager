import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { DONATE_ROTATE_MS, advanceCursor, donateTextKey, startCursor } from '@shared/donate';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { prefersReducedMotion } from '../../../shared/utils/dom.utils';
import { CryptoSliderComponent } from '../crypto-slider/crypto-slider.component';
import { DonateIconComponent } from '../donate-icon/donate-icon.component';
import { withAddress } from '../crypto-slider/crypto-slider.logic';
import { DONATE_CRYPTO, DONATE_LINKS } from '../donate.config';

/** Length of the fade (keep in sync with the transition in the stylesheet). */
const FADE_MS = 300;

/**
 * "Support the project": a joke on top, the Ko-fi and GitHub buttons below, then the slider of crypto wallets. The joke changes every 5 seconds with a fade
 * (without animation when the system asks for reduced motion). Closes by the cross, a click outside and Esc (the modal does it).
 */
@Component({
  selector: 'app-donate-popup',
  imports: [ModalComponent, IconComponent, DonateIconComponent, TranslatePipe, CryptoSliderComponent],
  templateUrl: './donate-popup.component.html',
  styleUrl: './donate-popup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DonatePopupComponent {
  readonly closed = output<void>();

  /** The first text is random every time the popup is opened. */
  private readonly cursor = signal(startCursor(Math.random));
  protected readonly kind = computed(() => this.cursor().kind);
  protected readonly textKey = computed(() => donateTextKey(this.cursor()));
  protected readonly hidden = signal(false);

  /** Support links that are filled in. */
  protected readonly links = DONATE_LINKS.filter((link) => link.url.trim() !== '');

  /** Crypto wallets that have an address (the slider is not shown without any). */
  protected readonly crypto = withAddress(DONATE_CRYPTO);

  constructor() {
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const rotate = setInterval(() => {
      if (prefersReducedMotion()) {
        this.cursor.update(advanceCursor);
        return;
      }
      this.hidden.set(true);
      fadeTimer = setTimeout(() => {
        this.cursor.update(advanceCursor);
        this.hidden.set(false);
      }, FADE_MS);
    }, DONATE_ROTATE_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(rotate);
      clearTimeout(fadeTimer);
    });
  }
}
