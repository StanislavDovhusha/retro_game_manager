import type { GameFile, ImageSource, ScanError } from '../../shared/models.ts';

export interface ImageFile {
  rel: string;
  abs: string;
}

export interface ScanResult {
  files: GameFile[];
  dirs: string[];
  images: ImageFile[];
  errors: ScanError[];
}

export interface ImageHit {
  abs: string;
  source: ImageSource;
  rel?: string;
}

export interface ImagesDirInfo {
  path: string;
  isDefault: boolean;
}

export interface PlatformPaths {
  imagesDir: string;
  csvPath: string;
  imagesExist: boolean;
  csvExists: boolean;
}

/** Looks up the cover for a game (manual binding, next to the game, in the images folder, by title). */
export type ImageFinder = (game: { rel: string; title?: string }, overrides?: Record<string, string>) => ImageHit | null;
