import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PublicSettings } from '@shared/models';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { inputValue } from '../../../shared/utils/dom.utils';
import { LibraryPathsService } from './library-paths.service';

/** Choosing the games folder, the images folder and the CSV file. */
@Component({
  selector: 'app-library-paths-dialog',
  imports: [ModalComponent, IconComponent, TranslatePipe],
  providers: [LibraryPathsService],
  templateUrl: './library-paths-dialog.component.html',
  styleUrl: './library-paths-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibraryPathsDialogComponent implements OnInit {
  protected readonly state = inject(LibraryPathsService);

  readonly settings = input.required<PublicSettings>();
  readonly closed = output<void>();

  protected readonly valueOf = inputValue;

  ngOnInit(): void {
    this.state.start(this.settings());
  }

  protected close(): void {
    if (!this.state.saving()) this.closed.emit();
  }

  protected async save(): Promise<void> {
    if (await this.state.save()) this.closed.emit();
  }
}
