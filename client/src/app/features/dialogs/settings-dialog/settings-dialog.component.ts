import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { PresentDirective } from '../../../shared/directives/present.directive';
import { TranslatePipe } from '@ngx-translate/core';
import type { PublicSettings } from '@shared/models';
import { SettingsStore } from '../../../core/state/settings.store';
import { EmulatorService } from '../../emulator/emulator.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { inputChecked, inputValue } from '../../../shared/utils/dom.utils';
import { CsvEditorDialogComponent } from '../csv-editor-dialog/csv-editor-dialog.component';
import { CsvPreviewComponent } from '../csv-preview/csv-preview.component';
import { CsvSettingsFormComponent } from '../csv-settings-form/csv-settings-form.component';
import { SettingsDraftService } from './settings-draft.service';
import { TourService } from '../../tour/tour.service';
import { UpdateService } from '../../update/update.service';
import { DeviceStore } from '../../../core/state/device.store';
import { COPYRIGHT, LICENSE_NAME, LICENSE_URL, REPOSITORY_URL } from '@shared/app-info';

/** Settings: game file extensions, CSV parameters with a preview of the file, backups, the emulator, the support popup. */
@Component({
  selector: 'app-settings-dialog',
  imports: [PresentDirective, ModalComponent, IconComponent, CsvSettingsFormComponent, CsvPreviewComponent, CsvEditorDialogComponent, TranslatePipe],
  providers: [SettingsDraftService],
  templateUrl: './settings-dialog.component.html',
  styleUrl: './settings-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDialogComponent implements OnInit {
  protected readonly state = inject(SettingsDraftService);
  protected readonly encodings = inject(SettingsStore).encodings;
  /** The emulator section exists only in the desktop application. */
  protected readonly emulator = inject(EmulatorService);
  private readonly tour = inject(TourService);
  protected readonly updates = inject(UpdateService);
  protected readonly devices = inject(DeviceStore);
  /** The "About" section: copyright, license and source code. */
  protected readonly about = { copyright: COPYRIGHT, license: LICENSE_NAME, licenseUrl: LICENSE_URL, repository: REPOSITORY_URL };

  readonly settings = input.required<PublicSettings>();
  readonly closed = output<void>();

  protected readonly valueOf = inputValue;
  protected readonly checkedOf = inputChecked;
  protected readonly editing = signal(false);

  ngOnInit(): void {
    this.state.start(this.settings());
  }

  /** While the CSV editor is open (it has its own close confirmation) the outer window does not close. */
  /** "Restart tour": the settings close (unsaved changes are dropped, as with Cancel) and the tour starts over. */
  protected restartTour(): void {
    this.closed.emit();
    this.tour.start();
  }

  protected requestClose(): void {
    if (!this.editing()) this.closed.emit();
  }

  protected async save(): Promise<void> {
    if (await this.state.save()) this.closed.emit();
  }
}
