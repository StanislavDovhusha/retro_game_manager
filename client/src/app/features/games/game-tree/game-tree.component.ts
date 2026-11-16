import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { LibraryFile } from '@shared/models';
import { FormatService } from '../../../core/services/format.service';
import { GameThumbComponent } from '../../../shared/components/game-thumb/game-thumb.component';
import { HighlightComponent } from '../../../shared/components/highlight/highlight.component';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { VirtualListComponent } from '../../../shared/components/virtual-list/virtual-list.component';
import type { SearchScope, TreeNode } from '../../../shared/models/ui.models';

type TreeRow =
  | { kind: 'dir'; node: TreeNode; depth: number; open: boolean }
  | { kind: 'file'; file: LibraryFile; depth: number };

const ROW_HEIGHT = 30;

/** Folder tree of the games (a flat, virtualized list of visible rows). Presentational. */
@Component({
  selector: 'app-game-tree',
  imports: [IconComponent, GameThumbComponent, HighlightComponent, VirtualListComponent, TranslatePipe],
  templateUrl: './game-tree.component.html',
  styleUrl: './game-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameTreeComponent {
  protected readonly fmt = inject(FormatService);

  readonly tree = input.required<TreeNode>();
  /** Relative paths of the games that match the filter; null when no filter is set. */
  readonly visible = input.required<ReadonlySet<string> | null>();
  readonly query = input.required<string>();
  readonly scope = input.required<SearchScope>();
  readonly selectedRel = input<string | null>(null);
  readonly selectedDir = input<string | null>(null);
  readonly version = input.required<number>();

  readonly selectFile = output<string>();
  readonly selectDir = output<string | null>();

  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  private readonly list = viewChild(VirtualListComponent);
  private pendingReveal = false;

  private readonly filtering = computed(() => this.visible() !== null);
  protected readonly nameQuery = computed(() => (this.scope() === 'ext' || this.scope() === 'dir' ? '' : this.query()));
  protected readonly resetKey = computed(() => `${this.query()}|${this.scope()}`);

  private readonly allDirs = computed(() => {
    const out: string[] = [];
    const walk = (node: TreeNode): void => node.dirs.forEach((dir) => { out.push(dir.path); walk(dir); });
    walk(this.tree());
    return out;
  });

  /** Folders that contain matching games (filter mode). */
  private readonly visibleDirs = computed<Set<string> | null>(() => {
    const visible = this.visible();
    if (!visible) return null;
    const set = new Set<string>();
    const walk = (node: TreeNode): boolean => {
      let any = node.files.some((file) => visible.has(file.rel));
      for (const dir of node.dirs) if (walk(dir)) any = true;
      if (any) set.add(node.path);
      return any;
    };
    walk(this.tree());
    return set;
  });

  /** The tree is turned into a flat list of visible rows; this list is what gets virtualized. */
  protected readonly rows = computed<TreeRow[]>(() => {
    const out: TreeRow[] = [];
    const visible = this.visible();
    const visibleDirs = this.visibleDirs();
    const expanded = this.expanded();
    const filtering = this.filtering();
    const walk = (node: TreeNode, depth: number): void => {
      for (const dir of node.dirs) {
        if (visibleDirs && !visibleDirs.has(dir.path)) continue;
        const open = filtering || expanded.has(dir.path);
        out.push({ kind: 'dir', node: dir, depth, open });
        if (open) walk(dir, depth + 1);
      }
      for (const file of node.files) {
        if (visible && !visible.has(file.rel)) continue;
        out.push({ kind: 'file', file, depth });
      }
    };
    walk(this.tree(), 0);
    return out;
  });

  protected readonly itemKey = (index: number): string => {
    const row = this.rows()[index];
    if (!row) return String(index);
    return row.kind === 'dir' ? `d:${row.node.path}` : `f:${row.file.rel}`;
  };

  constructor() {
    // The selected game expands the path to itself and becomes visible in the list.
    effect(() => {
      const rel = this.selectedRel();
      untracked(() => {
        if (!rel) return;
        const parts = rel.split('/').slice(0, -1);
        const expanded = this.expanded();
        const needsExpand = !this.filtering() && parts.some((_, i) => !expanded.has(parts.slice(0, i + 1).join('/')));
        if (needsExpand) {
          this.pendingReveal = true;
          const next = new Set(expanded);
          parts.forEach((_, i) => next.add(parts.slice(0, i + 1).join('/')));
          this.expanded.set(next);
        } else {
          this.reveal(rel);
        }
      });
    });

    effect(() => {
      this.rows();
      untracked(() => {
        if (!this.pendingReveal) return;
        this.pendingReveal = false;
        const rel = this.selectedRel();
        if (rel) queueMicrotask(() => this.reveal(rel));
      });
    });
  }

  private reveal(rel: string): void {
    this.list()?.scrollToIndex(this.rows().findIndex((row) => row.kind === 'file' && row.file.rel === rel));
  }

  expandAll(): void {
    this.expanded.set(new Set(this.allDirs()));
  }

  collapseAll(): void {
    this.expanded.set(new Set());
  }

  protected toggle(path: string): void {
    const next = new Set(this.expanded());
    if (!next.delete(path)) next.add(path);
    this.expanded.set(next);
  }

  protected clickDir(path: string, open: boolean): void {
    this.selectDir.emit(this.selectedDir() === path ? null : path);
    if (!open) this.toggle(path);
  }
}
