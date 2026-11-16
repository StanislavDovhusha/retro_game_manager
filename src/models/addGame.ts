import type { PlanMode } from '../../shared/models.ts';

/** A checked source file (a path on disk or a file uploaded to the staging folder). */
export interface InspectedSource {
  abs: string;
  fileName: string;
  ext: string;
  size: number;
  stagedId: string | null;
}

/** A piece of the game file: a selected file written as it is, or an ECM archive unpacked while it is written. */
export interface GamePart {
  input: InspectedSource;
  /** The name of the data: the file name, or for an ECM archive the name of the file inside it (`Game.bin`). */
  fileName: string;
  ecm: boolean;
  /** Bytes the part adds to the game file (for an ECM archive — the unpacked size). */
  size: number;
}

/** A file saved next to the game file under the game's name (the .ccd and .sub of a CloneCD set). */
export interface GameCompanion {
  input: InspectedSource;
  fileName: string;
}

/**
 * What adding a game will do: the parts are written one after another into `fileName` in the games folder
 * (one file — a copy; `.bin` files — merged in the `.cue` order; ECM archives — unpacked), the companions are copied
 * next to it.
 */
export interface GamePlan {
  mode: PlanMode;
  inputs: InspectedSource[];
  parts: GamePart[];
  companions: GameCompanion[];
  fileName: string;
  /** Size of the game file. */
  size: number;
  warnings: string[];
  needsImgExtension: boolean;
}

/** A file uploaded to the staging folder. */
export interface StagedFile {
  id: string;
  path: string;
  name: string;
  kind: 'game' | 'image';
  size: number;
  createdAt: number;
}
