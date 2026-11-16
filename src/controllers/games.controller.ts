import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { inputOf } from '../middlewares/validate.ts';
import {
  deleteGameInput,
  deleteGamesInput,
  deleteImageInput,
  getImageInput,
  renameInput,
  renamePreviewInput,
  setImageInput,
  updateEntryInput,
} from '../schemas/index.ts';
import { updateEntry } from '../services/entryService.ts';
import { deleteGame, deleteGames } from '../services/gameService.ts';
import { deleteImage, openImage, setImage } from '../services/imageService.ts';
import { previewRename, renameGame } from '../services/renameService.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

export const deleteGameHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rel, removeFromCsv } = inputOf(deleteGameInput, req).body;
  res.json(await deleteGame({ rel, removeFromCsv }));
});

export const deleteGamesHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rels, removeFromCsv } = inputOf(deleteGamesInput, req).body;
  res.json(await deleteGames({ rels, removeFromCsv }));
});

export const previewRenameHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rel, title } = inputOf(renamePreviewInput, req).body;
  res.json(await previewRename({ rel, title }));
});

export const renameGameHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rel, title } = inputOf(renameInput, req).body;
  res.json(await renameGame({ rel, title }));
});

export const updateEntryHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await updateEntry(inputOf(updateEntryInput, req).body));
});

/** Streams the cover to the client; the file system access itself lives in the image service. */
export const getImageHandler = asyncHandler(async (req: Request, res: Response) => {
  const { stream, contentType } = await openImage(inputOf(getImageInput, req).query.rel);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-cache');
  await pipeline(stream, res);
});

export const setImageHandler = asyncHandler(async (req: Request, res: Response) => {
  const { rel, imagePath } = inputOf(setImageInput, req).body;
  res.json(await setImage({ rel, imagePath }));
});

export const deleteImageHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json(await deleteImage({ rel: inputOf(deleteImageInput, req).body.rel }));
});
