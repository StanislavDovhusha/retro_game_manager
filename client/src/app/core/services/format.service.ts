import { Injectable, inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

/** Formats sizes, numbers and dates according to the interface language. */
@Injectable({ providedIn: 'root' })
export class FormatService {
  private readonly i18n = inject(I18nService);

  /** 1536 → "1.5 KB"; picks the unit: B, KB, MB, GB, TB. */
  size(bytes: number): string {
    if (bytes < 1024) return `${bytes} ${this.i18n.t('units.bytes')}`;
    const units = ['units.kb', 'units.mb', 'units.gb', 'units.tb'].map((key) => this.i18n.t(key));
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    const formatter = new Intl.NumberFormat(this.i18n.locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${formatter.format(value)} ${units[unit]}`;
  }

  number(value: number): string {
    return value.toLocaleString(this.i18n.locale());
  }

  time(timestamp: number | string): string {
    return new Date(timestamp).toLocaleTimeString(this.i18n.locale());
  }

  dateTime(timestamp: number | string): string {
    return new Date(timestamp).toLocaleString(this.i18n.locale(), { dateStyle: 'short', timeStyle: 'medium' });
  }
}
