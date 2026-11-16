import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { SdStateResponse } from '@shared/api';
import { ApiService } from '../../core/api/api.service';
import { SettingsStore } from '../../core/state/settings.store';
import { toErrorMessage } from '../../shared/utils/error.utils';
import type { SdLevel, SdRow } from './sd-card.models';

/** State of the SD card block: platform list and lazily loaded folder tree. Read-only: the card is never modified. */
@Injectable({ providedIn: 'root' })
export class SdCardService {
  private readonly api = inject(ApiService);
  private readonly settingsStore = inject(SettingsStore);

  private readonly expanded = signal<ReadonlySet<string>>(new Set());
  private readonly levels = signal<Readonly<Record<string, SdLevel>>>({});

  readonly root = computed(() => this.settingsStore.settings()?.sdRoot ?? '');
  readonly platform = computed(() => this.settingsStore.settings()?.platform ?? '');
  /** The console model: its profile names the platforms and tells media and system folders apart. */
  private readonly device = computed(() => this.settingsStore.settings()?.device ?? '');
  readonly state = signal<SdStateResponse | null>(null);
  readonly treeOpen = signal(true);

  /** The tree flattened into the visible rows. */
  readonly rows = computed<SdRow[]>(() => {
    const levels = this.levels();
    const expanded = this.expanded();
    const out: SdRow[] = [];
    const walk = (rel: string, depth: number): void => {
      const level = levels[rel];
      if (!level) return;
      if (level.loading && level.nodes.length === 0) out.push({ kind: 'loading', depth, key: `l:${rel}` });
      if (level.error) out.push({ kind: 'error', depth, key: `e:${rel}`, message: level.error });
      for (const node of level.nodes) {
        const open = expanded.has(node.rel);
        out.push({ kind: 'node', node, depth, open });
        if (open && node.hasChildren) walk(node.rel, depth + 1);
      }
      if (level.truncated) out.push({ kind: 'truncated', depth, key: `t:${rel}` });
    };
    walk('', 0);
    return out;
  });

  constructor() {
    // The card root (or the console model) changed: reload the platform list and the root of the tree.
    effect(() => {
      const root = this.root();
      this.device();
      untracked(() => {
        this.expanded.set(new Set());
        this.levels.set({});
        if (!root) { this.state.set(null); return; }
        void this.loadState();
        void this.loadLevel('');
      });
    });
    // A platform was chosen: refresh the selected value.
    effect(() => {
      this.platform();
      untracked(() => { if (this.root()) void this.loadState(); });
    });
  }

  toggleTree(): void {
    this.treeOpen.update((open) => !open);
  }

  toggle(rel: string): void {
    const next = new Set(this.expanded());
    if (next.has(rel)) {
      next.delete(rel);
    } else {
      next.add(rel);
      if (!this.levels()[rel]) void this.loadLevel(rel);
    }
    this.expanded.set(next);
  }

  private async loadState(): Promise<void> {
    try { this.state.set(await firstValueFrom(this.api.sdState())); } catch { /* the card is optional */ }
  }

  private async loadLevel(rel: string): Promise<void> {
    this.levels.update((levels) => ({ ...levels, [rel]: { loading: true, nodes: levels[rel]?.nodes ?? [], truncated: false } }));
    try {
      const response = await firstValueFrom(this.api.sdTree(rel));
      this.levels.update((levels) => ({ ...levels, [rel]: { loading: false, nodes: response.nodes, truncated: response.truncated } }));
    } catch (e) {
      const message = toErrorMessage(e);
      this.levels.update((levels) => ({ ...levels, [rel]: { loading: false, nodes: [], truncated: false, error: message } }));
    }
  }
}
