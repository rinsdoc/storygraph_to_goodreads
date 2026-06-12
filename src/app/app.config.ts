import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideTranslateService } from '@ngx-translate/core';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideTranslateService({ fallbackLang: 'es' })],
};
