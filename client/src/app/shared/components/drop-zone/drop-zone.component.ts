import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { FormatService } from '../../../core/services/format.service';
import { IconComponent } from '../icon/icon.component';
import type { IconName } from '../icon/icons';

/** A picked file: a path on disk (system dialog) or a file dropped into the window. */
export type PickedFile =
  | { kind: 'path'; path: string; name: string; size: number }
  | { kind: 'file'; file: File; name: string; size: number };

/** File upload zone: drag & drop or the "Browse" button (system dialog). Presentational. */
@Component({
  selector: 'app-drop-zone',
  imports: [IconComponent, TranslatePipe],
  templateUrl: './drop-zone.component.html',
  styleUrl: './drop-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropZoneComponent {
  protected readonly fmt = inject(FormatService);

  readonly label = input.required<string>();
  readonly hint = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly picked = input.required<readonly PickedFile[]>();
  readonly multiple = input(false);
  readonly preview = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly disabled = input(false);
  readonly autoFocus = input(false);

  readonly browse = output<void>();
  readonly dropFiles = output<File[]>();
  readonly clear = output<void>();

  protected readonly over = signal(false);
  private readonly browseButton = viewChild<ElementRef<HTMLButtonElement>>('browseBtn');
  protected readonly names = computed(() => this.picked().map((file) => file.name));
  protected readonly totalSize = computed(() => this.picked().reduce((sum, file) => sum + file.size, 0));
  protected readonly firstName = computed(() => this.picked()[0]?.name ?? '');
  protected readonly firstSize = computed(() => this.picked()[0]?.size ?? 0);
  protected readonly firstTitle = computed(() => {
    const file = this.picked()[0];
    return file ? (file.kind === 'path' ? file.path : file.name) : '';
  });

  constructor() {
    // The autofocus attribute does not work for dynamically created elements, so focus is set manually.
    afterNextRender(() => { if (this.autoFocus()) this.browseButton()?.nativeElement.focus(); });
  }

  protected onOver(event: DragEvent): void {
    event.preventDefault();
    this.over.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const list = Array.from(event.dataTransfer?.files ?? []);
    if (list.length && !this.disabled()) this.dropFiles.emit(this.multiple() ? list : list.slice(0, 1));
  }
}
