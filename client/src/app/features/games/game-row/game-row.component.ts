import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { hasUnsupportedChars } from '@shared/gameName';
import type { LibraryFile } from '@shared/models';
import { FormatService } from '../../../core/services/format.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { GameThumbComponent } from '../../../shared/components/game-thumb/game-thumb.component';
import { HighlightComponent } from '../../../shared/components/highlight/highlight.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import type { ActiveEdit, EditField } from '../../library/entry-edit.logic';
import { type InlineCommit, InlineInputComponent } from '../inline-input/inline-input.component';

const HINT_KEYS: Record<EditField, string> = {
  name: 'inlineEdit.hints.name',
  short: 'inlineEdit.hints.short',
  tags: 'inlineEdit.hints.tags',
};
const LABEL_KEYS: Record<EditField, string> = {
  name: 'inlineEdit.labels.name',
  short: 'inlineEdit.labels.short',
  tags: 'inlineEdit.labels.tags',
};

/** One row of the game table. Presentational: the title, the short name and the tags can be edited in place. */
@Component({
  selector: 'app-game-row',
  imports: [IconComponent, GameThumbComponent, HighlightComponent, InlineInputComponent, TranslatePipe],
  templateUrl: './game-row.component.html',
  styleUrl: './game-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameRowComponent {
  protected readonly fmt = inject(FormatService);
  private readonly i18n = inject(I18nService);

  readonly game = input.required<LibraryFile>();
  readonly gridTemplate = input.required<string>();
  readonly selected = input(false);
  readonly checked = input(false);
  readonly csvReady = input.required<boolean>();
  readonly version = input.required<number>();
  readonly nameQuery = input('');
  readonly pathQuery = input('');
  readonly tagsQuery = input('');
  /** The cell of this row that is being edited (null when none). */
  readonly edit = input<ActiveEdit | null>(null);

  readonly rowSelect = output<string>();
  /** The checkbox was clicked (the event carries the Shift state for range selection). */
  readonly checkClick = output<MouseEvent>();
  readonly editStart = output<EditField>();
  readonly editDraft = output<string>();
  readonly editCommit = output<InlineCommit>();
  readonly editCancel = output<void>();

  protected readonly tone = computed(() => {
    if (this.selected()) return 'bg-btn-500/15';
    if (this.checked()) return 'bg-shell-100 dark:bg-shell-900';
    return 'hover:bg-shell-100 dark:hover:bg-shell-900';
  });

  protected readonly csvTitle = computed(() => {
    const game = this.game();
    return [game.csvName, game.csvShort].filter(Boolean).join(' · ') || this.i18n.t('gameList.entryWithoutTitles');
  });

  /** The CSV is needed for every kind of editing (the title and the tags are saved there). */
  protected readonly editable = computed(() => this.csvReady());
  protected readonly editingField = computed(() => this.edit()?.field ?? null);
  protected readonly tagsText = computed(() => this.game().tags.join(' '));
  /** The title has characters the console cannot show (another alphabet): marked, the game has to be renamed. */
  protected readonly unsupportedTitle = computed(() => hasUnsupportedChars(this.game().title));

  protected hintKey(field: EditField): string {
    return HINT_KEYS[field];
  }

  protected labelKey(field: EditField): string {
    return LABEL_KEYS[field];
  }

  protected begin(field: EditField, event: Event): void {
    event.stopPropagation(); // starting to edit is not a click on the row
    if (this.editable()) this.editStart.emit(field);
  }

  /** The checkbox state is set through [checked]; the selection itself is handled in the click handler. */
  protected noop(): void { /* intentionally empty */ }
}
