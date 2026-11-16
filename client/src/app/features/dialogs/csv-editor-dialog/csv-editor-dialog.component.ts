import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { PresentDirective } from '../../../shared/directives/present.directive';
import { TranslatePipe } from '@ngx-translate/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { CsvEditorTableComponent } from '../csv-editor-table/csv-editor-table.component';
import { CsvEditorToolbarComponent } from '../csv-editor-toolbar/csv-editor-toolbar.component';
import { MissingGamesDialogComponent } from '../missing-games-dialog/missing-games-dialog.component';
import { CsvEditorService } from './csv-editor.service';

/** Full-screen editor of the CSV file. */
@Component({
  selector: 'app-csv-editor-dialog',
  imports: [PresentDirective, ModalComponent, IconComponent, CsvEditorToolbarComponent, CsvEditorTableComponent, MissingGamesDialogComponent, TranslatePipe],
  providers: [CsvEditorService],
  templateUrl: './csv-editor-dialog.component.html',
  styleUrl: './csv-editor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvEditorDialogComponent implements OnInit {
  protected readonly state = inject(CsvEditorService);
  private readonly i18n = inject(I18nService);

  /** The path column from the settings (the first column is used when it is not set). */
  readonly pathColumn = input.required<string>();
  readonly closed = output<void>();
  /** The CSV file was changed: the interface has to be refreshed. */
  readonly saved = output<void>();

  ngOnInit(): void {
    this.state.pathColumn.set(this.pathColumn());
    void this.state.load();
  }

  protected async save(): Promise<void> {
    if (await this.state.save()) this.saved.emit();
  }

  protected async confirmRemoveMissing(): Promise<void> {
    if (await this.state.confirmRemoveMissing()) this.saved.emit();
  }

  /** Esc and a click on the backdrop: while a confirmation is open the outer window stays open. */
  protected requestClose(): void {
    if (!this.state.missing()) this.close();
  }

  protected close(): void {
    if (!this.state.dirty() || window.confirm(this.i18n.t('csvEditor.unsavedConfirm'))) this.closed.emit();
  }
}
