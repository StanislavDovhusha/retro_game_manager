import type { LibraryFile } from '@shared/models';

/** Folder and file paths of the library. */
export interface LibraryPaths {
  gamesDir: string;
  imagesDir: string;
  csvPath: string;
}

/** What the user asked to delete in the details panel. */
export interface DeleteRequest {
  kind: 'game' | 'image';
  game: LibraryFile;
}
