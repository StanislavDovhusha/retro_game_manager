import type { SdNode } from '@shared/models';

/** One loaded level (folder) of the SD card tree. */
export interface SdLevel {
  loading: boolean;
  nodes: SdNode[];
  truncated: boolean;
  error?: string;
}

/** A flat row of the SD card tree: the tree is turned into a list of visible rows. */
export type SdRow =
  | { kind: 'node'; node: SdNode; depth: number; open: boolean }
  | { kind: 'loading' | 'truncated'; depth: number; key: string }
  | { kind: 'error'; depth: number; key: string; message: string };
