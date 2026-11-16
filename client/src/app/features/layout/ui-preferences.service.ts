import { Injectable, inject } from '@angular/core';
import type { ColumnKey, Lang, PublicSettings } from '@shared/models';
import { AUTO_LANG } from '@shared/constants';
import { I18nService, systemLang } from '../../core/i18n/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { SettingsStore } from '../../core/state/settings.store';
import { toErrorMessage } from '../../shared/utils/error.utils';
import { PanelLayoutService } from './panel-layout.service';

/** User interface preferences stored in the settings: language, theme, panels and column widths. */
@Injectable({ providedIn: 'root' })
export class UiPreferencesService {
  private readonly settingsStore = inject(SettingsStore);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly panels = inject(PanelLayoutService);
  /** Current interface language. */
  readonly lang = this.i18n.lang;
  private widthTimer: ReturnType<typeof setTimeout> | undefined;
  private applied = false;

  /**
   * Applies the saved language and panel state once, when the settings arrive.
   * The language is kept in the settings (shared by all browsers) and in localStorage (no flicker on load).
   * Resolves once the dictionary of the saved language is loaded (notices shown at start wait for it).
   * On the first start the settings hold `auto`: the interface opens in the language of the system when it is supported.
   */
  applySaved(settings: PublicSettings): Promise<void> {
    if (this.applied) return Promise.resolve();
    this.applied = true;
    if (settings.ui) this.panels.restore(settings.ui);
    // `auto` (nothing chosen yet): the language of the system, and nothing is saved until the user picks one.
    const saved = settings.ui?.language;
    const language = saved === AUTO_LANG ? systemLang() : saved;
    return language && language !== this.i18n.lang() ? this.i18n.setLang(language) : Promise.resolve();
  }

  changeLanguage(lang: Lang): void {
    void this.i18n.setLang(lang);
    this.save({ ui: { language: lang } });
  }

  toggleTheme(): void {
    const settings = this.settingsStore.settings();
    if (!settings) return;
    this.save({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  /** Column widths are saved with a delay while the user is still dragging a column border. */
  saveColumnWidths(widths: Record<ColumnKey, number>): void {
    clearTimeout(this.widthTimer);
    this.widthTimer = setTimeout(() => this.save({ ui: { columnWidths: widths } }), 300);
  }

  private save(patch: Parameters<SettingsStore['save']>[0]): void {
    this.settingsStore.save(patch).catch((e: unknown) => this.toasts.push('error', toErrorMessage(e)));
  }
}
