import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { LANGUAGES, Language, LanguageService } from '../../core/i18n/i18n';

/** DE / EN toggle. */
@Component({
  selector: 'app-language-switch',
  templateUrl: './language-switch.html',
  styleUrl: './language-switch.scss',
  imports: [TranslocoDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSwitch {
  private readonly languages = inject(LanguageService);

  protected readonly options = LANGUAGES;
  protected readonly active = signal<Language>(this.languages.current());

  protected select(language: Language): void {
    this.languages.use(language);
    this.active.set(language);
  }
}
