import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { langInterceptor } from './core/api/lang.interceptor';
import { I18nService } from './core/i18n/i18n.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(withInterceptors([langInterceptor])),
    // Dictionaries: public/i18n/<language>.json. Keys are English identifiers (for example `settings.title`);
    // en.json is the primary dictionary with every key and the fallback for the other languages.
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
      fallbackLang: 'en',
    }),
    // The dictionary of the saved language is loaded before the first render, so keys never flash on screen.
    provideAppInitializer(() => inject(I18nService).init()),
  ],
};
