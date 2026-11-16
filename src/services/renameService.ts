import fs from 'node:fs/promises';
import path from 'node:path';
import { t } from '../i18n/index.ts';
import type { CsvTable, RenameGameResponse, RenamePlanResponse, RenameStep, Settings } from '../models/index.ts';
import { atomicWrite } from '../utils/atomicWrite.ts';
import { BadRequestError, ConflictError, ForbiddenError, InternalError, AppError, ValidationError } from '../utils/errors.ts';
import { errorCode, errorMessage } from '../utils/guards.ts';
import { runExclusive } from '../utils/lock.ts';
import { assertNotProtected, baseNoExt, isInside, normalizeRel, safeResolveExisting, statOrNull } from '../utils/paths.ts';
import { normalizeTitle, toCamelCase, toSafeFileName } from '../utils/text.ts';
import { csvLookup, renameEntry, upsertGame } from './csv/plan.ts';
import { readCsv, writeCsv } from './csv/store.ts';
import { backupFile } from './backupService.ts';
import { readCoverMarker, renderCover, type CoverMarker } from './fs/coverArt.ts';
import { writePng } from './fs/imageConvert.ts';
import { resolveImagesDir } from './fs/imageIndex.ts';
import { getImagePath } from './imageService.ts';
import { logger } from '../utils/logger.ts';
import { journal } from './journalService.ts';
import { invalidateScan } from './libraryService.ts';
import { listsLocation, planListChange } from './consoleLists.ts';
import { deviceById } from './devices/registry.ts';
import { listPath } from './lists/listLines.ts';
import { getSettings, patchInternal } from './settingsService.ts';
import { csvReadOptions } from './deviceService.ts';

/**
 * Renaming a game together with everything that belongs to it.
 *
 * This is the ONLY place where the application changes anything inside the saves folder of the console (`cubegm` on
 * the current models; the other system folders stay untouchable), and only what the console's profile lists (`saves`
 * in `devices/*.json`): the saves, the quick saves (states), the lists of games (`allfiles.lst`, …) and the core
 * bindings (`cores/filelist.xml`). No other module writes into system folders.
 */

const MAX_DEPTH = 3;
const MAX_ENTRIES = 50000;

interface Move {
  kind: 'game' | 'image' | 'save' | 'state';
  from: string;
  to: string;
}
interface TextEdit {
  kind: 'list' | 'cores';
  file: string;
  original: Buffer;
  next: Buffer;
  count: number;
}
interface Plan {
  response: RenamePlanResponse;
  moves: Move[];
  edits: TextEdit[];
  csvNext: CsvTable | null;
  oldRel: string;
  imageOverride: { from: string; to: string } | null;
  /** A generated cover shows the title: it is drawn again for the new title (at its new path). */
  cover: (CoverMarker & { file: string }) | null;
  settings: Settings;
}

/** Does the name match "<stem>" or "<stem>.<ext>[.<another>]", without false hits on "Mario 2"? */
function matchesStem(name: string, stem: string): boolean {
  const normalized = name.normalize('NFC');
  if (!normalized.startsWith(stem)) return false;
  const rest = normalized.slice(stem.length);
  return rest === '' || /^(\.[A-Za-z0-9_]{1,12}){1,2}$/.test(rest);
}

async function collect(dir: string, stem: string, depth: number, out: string[]): Promise<void> {
  if (out.length > MAX_ENTRIES) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (errorCode(err) === 'ENOENT' || errorCode(err) === 'ENOTDIR') return;
    throw err;
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (entry.name.normalize('NFC') === stem)
        out.push(abs); // a save folder named after the game
      else if (depth < MAX_DEPTH) await collect(abs, stem, depth + 1, out);
    } else if (entry.isFile() && matchesStem(entry.name, stem)) {
      out.push(abs);
    }
  }
}

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const xmlEscape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * Replaces "Platform/old path" with the new one (both kinds of slashes, NFC/NFD, XML escaping).
 * Returns the number of replacements.
 */
export function replacePaths(text: string, oldPath: string, newPath: string): { text: string; count: number } {
  const pairs = new Map<string, string>();
  const add = (from: string, to: string): void => {
    if (from) pairs.set(from, to);
  };
  for (const [a, b] of [
    [oldPath, newPath],
    [oldPath.normalize('NFD'), newPath.normalize('NFD')],
  ] as const) {
    add(a, b);
    add(a.replace(/\//g, '\\'), b.replace(/\//g, '\\'));
    add(xmlEscape(a), xmlEscape(b));
  }
  const alternatives = [...pairs.keys()]
    .sort((x, y) => y.length - x.length)
    .map(escapeRe)
    .join('|');
  // The path must be a whole path: it must not continue a longer name on the left ("XSFC/a.zip" is another platform),
  // and what follows must be the end of the line, whitespace, a quote or a separator.
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![^\\s"'<>,;|])`, 'gu');
  let count = 0;
  const out = text.replace(re, (match) => {
    count += 1;
    return pairs.get(match) ?? match;
  });
  return { text: out, count };
}

function decodeText(buf: Buffer): string | null {
  if (buf.includes(0)) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf);
  } catch {
    return null;
  }
}

const sameFile = async (a: string, b: string): Promise<boolean> => {
  const [x, y] = await Promise.all([statOrNull(a), statOrNull(b)]);
  return Boolean(x && y && x.ino === y.ino && x.dev === y.dev);
};

/** What else a rename may change in the CSV entry (the table editor sets these together with the title). */
export interface RenameExtras {
  /** The short title; without it the usual rule applies (regenerated only when it was generated before). */
  short?: string;
  tags?: readonly string[];
  /** The game has no CSV entry yet: create one instead of leaving the CSV untouched. */
  createEntry?: boolean;
}

async function buildPlan(relInput: string, titleInput: string, extras: RenameExtras = {}): Promise<Plan> {
  const settings = await getSettings();
  const title = normalizeTitle(titleInput);
  if (!settings.gamesDir) throw new BadRequestError(t('Choose the games folder first'));

  const oldAbs = await safeResolveExisting(settings.gamesDir, relInput);
  assertNotProtected(oldAbs);
  const st = await fs.stat(oldAbs);
  if (!st.isFile()) throw new ValidationError(t('Only a game file can be renamed'));

  const oldRel = normalizeRel(relInput);
  const dirRel = oldRel.includes('/') ? oldRel.slice(0, oldRel.lastIndexOf('/') + 1) : '';
  const oldFile = path.basename(oldAbs);
  const ext = path.extname(oldFile);
  const oldStem = baseNoExt(oldFile).normalize('NFC');
  const newBase = toSafeFileName(title);
  if (!newBase) throw new ValidationError(t('A file name cannot be made from this title — change the title'));
  const newFile = newBase + ext;
  const newRel = dirRel + newFile;
  const newAbs = path.join(path.dirname(oldAbs), newFile);

  const steps: RenameStep[] = [];
  const warnings: string[] = [];
  const listErrors: string[] = [];
  const moves: Move[] = [];
  const edits: TextEdit[] = [];
  const targets = new Set<string>([newAbs.toLowerCase()]);

  /** A rename target must not exist (except for a case-only change of the same file's name). */
  const claim = async (from: string, to: string, what: string): Promise<void> => {
    const key = to.toLowerCase();
    if (to.toLowerCase() !== from.toLowerCase() && targets.has(key) && what !== 'game') {
      throw new ConflictError(t('Two files would get the same name: {to}', { to }));
    }
    targets.add(key);
    if ((await statOrNull(to)) && !(await sameFile(from, to))) throw new ConflictError(t('The file already exists: {to}', { to }));
  };

  // 1. The game file.
  if (newFile !== oldFile) {
    await claim(oldAbs, newAbs, 'game');
    moves.push({ kind: 'game', from: oldAbs, to: newAbs });
    steps.push({ kind: 'game', from: oldRel, to: newRel });
  }

  // 2. The cover (only inside the games folder or the images folder).
  let imageOverride: Plan['imageOverride'] = null;
  let cover: Plan['cover'] = null;
  const imageAbs = await getImagePath(oldRel);
  const overrideFrom = settings.imageOverrides[oldRel];
  if (imageAbs) {
    const imagesDir = await resolveImagesDir(settings);
    const roots = [settings.gamesDir, imagesDir?.path].filter((root): root is string => Boolean(root));
    if (roots.some((root) => isInside(root, imageAbs))) {
      assertNotProtected(imageAbs);
      const imageNew = path.join(path.dirname(imageAbs), newBase + path.extname(imageAbs));
      if (imageNew !== imageAbs) {
        await claim(imageAbs, imageNew, 'image');
        moves.push({ kind: 'image', from: imageAbs, to: imageNew });
        steps.push({ kind: 'image', from: path.basename(imageAbs), to: path.basename(imageNew) });
      }
      if (overrideFrom) imageOverride = { from: overrideFrom, to: imageNew === imageAbs ? overrideFrom : imageNew };
      // A cover the application generated is redrawn with the new title; a picture the user chose is only renamed.
      const marker = await readCoverMarker(imageAbs);
      if (marker && marker.title !== title) {
        cover = { file: imageNew, title, platform: settings.platform };
        steps.push({ kind: 'cover', from: path.basename(imageNew), to: null });
      }
    } else {
      warnings.push(t('The cover is outside the games and images folders — its name is not changed: {imageAbs}', { imageAbs }));
      if (overrideFrom) imageOverride = { from: overrideFrom, to: overrideFrom };
    }
  }

  // 3. The CSV.
  let csvNext: CsvTable | null = null;
  let short = toCamelCase(title);
  if (settings.csvPath) {
    const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
    if (csv.exists) {
      const lookup = csvLookup(csv, settings.csv.columns, settings.csv.pathPrefix);
      const oldKey = oldRel.toLowerCase();
      for (const [key, value] of lookup) {
        if (key !== oldKey && value.name && value.name.toLowerCase() === title.toLowerCase()) {
          throw new ConflictError(
            t('A game titled “{cleanTitle}” is already in the CSV ({key}). Change the title.', { cleanTitle: title, key }),
          );
        }
      }
      const result = renameEntry(csv, settings.csv.columns, settings.csv.pathPrefix, oldRel, newFile, (old) => {
        // The short title is updated only when it was generated automatically from the previous title.
        const auto = !old.short || old.short === toCamelCase(old.name || oldStem);
        const nextShort = extras.short ?? (auto ? toCamelCase(title) : old.short);
        short = nextShort;
        return { name: title, short: nextShort, tags: extras.tags };
      });
      if (result.renamed) {
        csvNext = result.csv;
        steps.push({ kind: 'csv', from: path.basename(settings.csvPath), to: null, count: result.renamed });
      } else if (extras.createEntry) {
        short = extras.short ?? toCamelCase(title);
        csvNext = upsertGame(csv, settings.csv.columns, settings.csv.pathPrefix, {
          rel: newRel,
          name: title,
          short,
          tags: extras.tags,
        }).csv;
        steps.push({ kind: 'csv', from: path.basename(settings.csvPath), to: null, count: 1 });
      } else {
        warnings.push(t('There is no entry for this game in the CSV — the CSV will not change'));
      }
    } else if (extras.createEntry) {
      short = extras.short ?? toCamelCase(title);
      csvNext = upsertGame(csv, settings.csv.columns, settings.csv.pathPrefix, { rel: newRel, name: title, short, tags: extras.tags }).csv;
      steps.push({ kind: 'csv', from: path.basename(settings.csvPath), to: null, count: 1 });
    } else {
      warnings.push(t('The CSV file does not exist yet — the CSV will not change'));
    }
  } else {
    warnings.push(t('CSV is not configured'));
  }

  // 4. The saves folder of the console (cubegm): only when the games folder is <SD root>/<platform>.
  const { sdRoot, platform } = settings;
  const device = deviceById(settings.device);
  const savesFolder = device.folders.saves;
  const onCard =
    Boolean(sdRoot && platform) && path.resolve(settings.gamesDir).toLowerCase() === path.resolve(sdRoot, platform).toLowerCase();
  const cubegm = onCard && savesFolder ? path.join(sdRoot, savesFolder) : null;
  const coresFile = device.saves.cores ? path.normalize(device.saves.cores) : '';
  if (!savesFolder) {
    // The console keeps no saves or lists on the card: nothing to update there.
  } else if (!cubegm) {
    warnings.push(t('Select a platform on the SD card — then saves and lists in {folder} will be updated', { folder: savesFolder }));
  } else if (!(await statOrNull(cubegm))?.isDirectory()) {
    warnings.push(t('The {folder} folder was not found on the card — saves and lists are left untouched', { folder: savesFolder }));
  } else if (newBase !== oldStem) {
    const dirs = (
      [
        [device.saves.saves, 'save'],
        [device.saves.states, 'state'],
      ] as const
    ).filter(([sub]) => sub !== '');
    for (const [sub, kind] of dirs) {
      const base = path.join(cubegm, sub);
      const found: string[] = [];
      await collect(base, oldStem, 0, found);
      for (const abs of found) {
        const name = path.basename(abs);
        const to = path.join(path.dirname(abs), newBase + name.normalize('NFC').slice(oldStem.length));
        if (!isInside(base, abs) || !isInside(base, to)) continue;
        await claim(abs, to, kind);
        moves.push({ kind, from: abs, to });
        steps.push({ kind, from: path.relative(cubegm, abs), to: path.relative(cubegm, to) });
      }
    }
    // The core bindings name the game by its path: only the path changes there.
    const oldPath = `${platform}/${oldRel}`;
    const newPath = `${platform}/${newRel}`;
    for (const name of coresFile ? [coresFile] : []) {
      const file = path.join(cubegm, name);
      let original: Buffer;
      try {
        original = await fs.readFile(file);
      } catch (err) {
        if (errorCode(err) === 'ENOENT') continue;
        throw new InternalError(t('Could not read {name}: {message}', { name, message: errorMessage(err) }), { cause: err });
      }
      const text = decodeText(original);
      if (text === null) {
        warnings.push(t('The file {name} is not UTF-8 text or is binary — skipped', { name }));
        continue;
      }
      const result = replacePaths(text, oldPath, newPath);
      if (result.count > 0) {
        edits.push({ kind: 'cores', file, original, next: Buffer.from(result.text, 'utf8'), count: result.count });
        steps.push({ kind: 'cores', from: name, to: null, count: result.count });
      }
    }
  }
  // The game lists (allfiles.lst, favorites.lst, recent.lst): the line of the game gets the new path, title and short
  // name in place, in every list that has it (also when only the title or the short name changed).
  if (cubegm && (await statOrNull(cubegm))?.isDirectory()) {
    const listPlan = await planListChange(listsLocation(settings), {
      kind: 'put',
      oldPath: listPath(platform, oldRel),
      game: { platform, rel: newRel, title, short },
      add: false,
    });
    for (const edit of listPlan.edits) {
      if (!edit.original) continue; // a rename never creates a list (nothing to add)
      const count = edit.added + edit.updated + edit.removed;
      edits.push({ kind: 'list', file: edit.file, original: edit.original, next: edit.next, count });
      steps.push({ kind: 'list', from: edit.name, to: null, count });
    }
    warnings.push(...listPlan.warnings);
    listErrors.push(...listPlan.errors);
  }

  if (!steps.length && csvNext === null)
    throw new BadRequestError(t('Nothing would change: the title and file name are already like this'));

  return {
    response: { rel: oldRel, newRel, title, short, steps, warnings, listErrors },
    moves,
    edits,
    csvNext,
    oldRel,
    imageOverride,
    cover,
    settings,
  };
}

/** What would be renamed (changes nothing). */
export async function previewRename({ rel, title }: { rel: string; title: string }): Promise<RenamePlanResponse> {
  return (await buildPlan(rel, title)).response;
}

/**
 * Renames a game: the file, the cover, the saves, the CSV entry and the cubegm lists. All targets are checked
 * first (name conflicts); when something fails midway, everything already done is rolled back.
 */
export function renameGame({ rel, title, ...extras }: { rel: string; title: string } & RenameExtras): Promise<RenameGameResponse> {
  return runExclusive(t('renaming a game'), async () => {
    const plan = await buildPlan(rel, title, extras);
    const { settings, moves, edits } = plan;
    const done: Move[] = [];
    const written: TextEdit[] = [];
    let csvBackupPath: string | null = null;
    const warnings = plan.response.warnings;
    // The new cover is drawn before anything changes; when that fails the rename still goes on with the old picture.
    const coverFailed = (err: unknown, file: string): void => {
      logger.error({ err, file }, 'Cover: could not be redrawn after renaming');
      const message = t('The generated cover could not be redrawn with the new title: {message}', { message: errorMessage(err) });
      warnings.push(message);
      journal('warn', message);
    };
    let coverPng: Buffer | null = null;
    if (plan.cover) {
      logger.info({ file: plan.cover.file, title: plan.cover.title }, 'Cover: redrawing the generated cover with the new title');
      try {
        coverPng = await renderCover(plan.cover, deviceById(plan.settings.device));
      } catch (err) {
        coverFailed(err, plan.cover.file);
      }
    }
    try {
      for (const move of moves) {
        await fs.rename(move.from, move.to);
        done.push(move);
      }
      for (const edit of edits) {
        // The copy goes to the data folder on the computer: backups/<card id>/<platform>/allfiles.lst.bak-<time>.
        await backupFile(edit.file, { platform: settings.platform, data: edit.original });
        await atomicWrite(edit.file, edit.next);
        written.push(edit);
      }
      if (plan.csvNext) csvBackupPath = await writeCsv(settings.csvPath, plan.csvNext);
    } catch (err) {
      for (const edit of written.reverse()) await atomicWrite(edit.file, edit.original).catch(() => undefined);
      for (const move of done.reverse()) await fs.rename(move.to, move.from).catch(() => undefined);
      invalidateScan();
      journal('error', t('Renaming “{rel}” failed, changes were rolled back: {message}', { rel: plan.oldRel, message: errorMessage(err) }));
      if (err instanceof AppError) throw err;
      const code = errorCode(err);
      const message = t('Could not rename: {message}', { message: errorMessage(err) });
      throw code === 'EACCES' || code === 'EPERM'
        ? new ForbiddenError(message, { cause: err })
        : new InternalError(message, { cause: err });
    }

    if (plan.cover && coverPng) {
      try {
        await writePng(plan.cover.file, coverPng);
        logger.info({ file: plan.cover.file }, 'Cover: redrawn');
      } catch (err) {
        coverFailed(err, plan.cover.file);
      }
    }
    if (plan.imageOverride) {
      const { from, to } = plan.imageOverride;
      await patchInternal((s) => {
        delete s.imageOverrides[plan.oldRel];
        s.imageOverrides[plan.response.newRel] = to || from;
      }).catch((err: unknown) =>
        journal(
          'warn',
          t('The game was renamed, but the manually chosen cover was not carried over: {message}', { message: errorMessage(err) }),
        ),
      );
    }
    invalidateScan();
    for (const error of plan.response.listErrors ?? []) journal('error', error);
    journal(
      'success',
      t('Game renamed: “{from}” → “{to}” (files: {n}, lists and bindings: {m})', {
        from: plan.oldRel,
        to: plan.response.newRel,
        n: moves.length,
        m: edits.length,
      }),
    );
    return { ...plan.response, csvBackupPath };
  });
}
