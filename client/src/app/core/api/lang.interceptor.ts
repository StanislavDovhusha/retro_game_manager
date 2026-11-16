import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';

/**
 * The language is sent with every API request: the server answers with messages in it.
 *
 * Other requests (the dictionaries in /i18n/) pass untouched — and must not inject I18nService: ngx-translate loads
 * the fallback dictionary while TranslateService is being created, which happens while I18nService is being created,
 * so asking for I18nService here would be a circular dependency (NG0200) and the English dictionary would never load.
 */
export const langInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/api/') ? next(req.clone({ setHeaders: { 'X-Lang': inject(I18nService).lang() } })) : next(req);
