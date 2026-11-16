import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import path from 'node:path';
import { IMAGE_EXTENSIONS, MAX_GAME_FILES } from '../../shared/constants.ts';
import { canCompressToZip } from '../../shared/devices.ts';
import { deviceById } from './devices/registry.ts';
import { DISC_SET_EXTENSIONS, detectDiscSet, discSetFile, discSetTitle, type DiscSetIssue } from '../../shared/discSet.ts';
import { t } from '../i18n/index.ts';
import type { Readable } from 'node:stream';
import type {
  AddGameResponse,
  AddPhase,
  FileKind,
  GamePart,
  GamePlan,
  InspectedSource,
  PlanDescription,
  Settings,
  SourceRef,
  UploadResponse,
} from '../models/index.ts';
import { BadRequestError, ConflictError, PathTraversalError, ValidationError, type AppError } from '../utils/errors.ts';
import { assertFreeSpace } from '../utils/diskSpace.ts';
import { errorCode, errorMessage } from '../utils/guards.ts';
import { fsError } from '../utils/fsErrors.ts';
import { runExclusive } from '../utils/lock.ts';
import { assertAbsoluteInside, assertDirectory, baseNoExt, extOf, isInside } from '../utils/paths.ts';
import { normalizeTitle, toCamelCase, toSafeFileName } from '../utils/text.ts';
import { updateConsoleLists } from './consoleLists.ts';
import { csvLookup, upsertGame } from './csv/plan.ts';
import { readCsv, writeCsv } from './csv/store.ts';
import { buildAtomic, copyAtomic } from './fs/copy.ts';
import { withTempDir } from './tempService.ts';
import { ZIP_MAX_BYTES, zipAtomic, zipSizeBound } from './fs/zip.ts';
import { scanEcm } from './fs/ecm.ts';
import { clearAddProgress, setAddProgress } from './addProgress.ts';
import { renderCover } from './fs/coverArt.ts';
import { convertToPng, writePng } from './fs/imageConvert.ts';
import { parseCue, pairBins, readCueText } from './fs/cue.ts';
import { assertImageFile } from './fs/imageSignature.ts';
import { logger } from '../utils/logger.ts';
import { journal } from './journalService.ts';
import { invalidateScan } from './libraryService.ts';
import { getSettings, patchInternal } from './settingsService.ts';
import { discardStaged, resolveStaged, stageUpload } from './uploadService.ts';
import { assertNotMediaFolder, csvReadOptions } from './deviceService.ts';

/** Parts of disc image sets (.bin/.cue, .ccd/.img/.sub, .ecm): always acceptable, the resulting extension is checked separately (strict mode). */
const DISC_PARTS = DISC_SET_EXTENSIONS;
/** Text files of a set (.cue, .ccd) are small; a large one is not what its extension says. */
const MAX_TEXT_SIZE = 1024 * 1024;
/** A raw CD sector (.img / .bin of a CD image). */
const RAW_SECTOR = 2352;
/** Subchannel data per sector in a CloneCD .sub. */
const SUB_SECTOR = 96;

/**
 * Whether the .ccd and .sub of a CloneCD set are copied next to the .img. The console's emulator reads a bare .img
 * (exactly as for .bin + .cue, whose .cue is not copied either), and renaming, deleting and syncing games do not
 * know about such side files, so by default they are not copied to the card.
 */
export const KEEP_CLONECD_COMPANIONS = false;

/** An allowed extension: a game must be in the settings list (when it is set) and must not be an image; an image must be in the image list. */
export function assertAllowedExtension(
  kind: FileKind,
  ext: string,
  settings: Pick<Settings, 'extensions'>,
  { strict = false }: { strict?: boolean } = {},
): void {
  if (kind === 'image') {
    if (!IMAGE_EXTENSIONS.includes(ext)) throw new ValidationError(t('Supported images: PNG, JPG, JPEG, WEBP (also BMP, GIF)'));
    return;
  }
  if (!ext || IMAGE_EXTENSIONS.includes(ext)) throw new ValidationError(t('Choose a game file (an image does not fit here)'));
  // .bin and .cue are always acceptable as parts of a disc image; the resulting extension is checked separately (strict).
  if (!strict && DISC_PARTS.includes(ext)) return;
  if (settings.extensions.length && !settings.extensions.includes(ext)) {
    throw new ValidationError(
      t('The .{ext} extension is not in the list of game extensions ({v1}). Add it in “Settings → Extensions”.', {
        ext,
        v1: settings.extensions.join(', '),
      }),
    );
  }
}

/** Checks a selected file (a path on disk or an uploaded one) and describes it. */
export async function inspectSource(source: SourceRef, kind: FileKind, settings: Pick<Settings, 'extensions'>): Promise<InspectedSource> {
  let abs: string;
  let name: string;
  let stagedId: string | null = null;
  if (source.type === 'upload') {
    const file = await resolveStaged(source.id);
    abs = file.path;
    name = file.name;
    stagedId = file.id;
  } else {
    // A source is only read, so it may live anywhere on disk, but it must be a real absolute path.
    abs = assertAbsoluteInside(source.path, null, t('File'));
    name = path.basename(abs);
  }

  let st: Stats;
  try {
    st = await fs.stat(abs);
    await fs.access(abs, fs.constants.R_OK);
  } catch (err) {
    throw errorCode(err) === 'ENOENT'
      ? new BadRequestError(t('File not found: {name}', { name }))
      : fsError(err, t('file “{name}”', { name }));
  }
  if (!st.isFile()) throw new ValidationError(t('“{name}” is not a file', { name }));
  if (st.size === 0) throw new ValidationError(t('The file “{name}” is empty', { name }));
  const ext = extOf(name);
  if ((ext === 'cue' || ext === 'ccd') && st.size > MAX_TEXT_SIZE) {
    throw new ValidationError(t('The file “{name}” is too large for a .{ext}', { name, ext }));
  }
  assertAllowedExtension(kind, ext, settings);
  if (kind === 'image' && source.type === 'path') await assertImageFile(abs); // uploads were checked on arrival
  return { abs, fileName: name, ext, size: st.size, stagedId };
}

/**
 * Receives a file the browser uploads as a raw stream (drag and drop). The name comes URL-encoded in the
 * X-File-Name header; only its last path segment is used, and its extension must be allowed for the kind.
 */
export async function receiveUpload(
  req: Readable & { headers: Record<string, unknown> },
  { kind, fileNameHeader }: { kind: FileKind; fileNameHeader: string },
): Promise<UploadResponse> {
  let name: string;
  try {
    name = decodeURIComponent(fileNameHeader);
  } catch {
    throw new ValidationError(t('Invalid file name'));
  }
  name = path.basename(name.replace(/\\/g, '/'));
  if (!name) throw new ValidationError(t('File name not specified'));
  assertAllowedExtension(kind, extOf(name), await getSettings());
  return stageUpload(req, { kind, name });
}

async function listNames(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (err) {
    if (errorCode(err) === 'ENOENT') return [];
    throw err;
  }
}

/**
 * The name under which a game file is saved in the games folder (without extension): the game title.
 * Without a title (the preliminary check of the files) the base of the source file name is used.
 */
function gameBaseName(title: string, sourceBase: string): string {
  const clean = title.trim();
  if (clean) {
    const base = toSafeFileName(clean);
    if (!base) throw new ValidationError(t('A game file name cannot be built from this title — change the title'));
    return base;
  }
  return toSafeFileName(sourceBase) || 'game';
}

/** A problem with the set of selected files, as an error with a clear message. */
function discSetError(issue: DiscSetIssue): AppError {
  switch (issue.code) {
    case 'empty':
      return new BadRequestError(t('No file selected'));
    case 'mixed':
      return new ValidationError(
        t('Only the parts of one disc image can be selected together: .bin + .cue, .ccd + .img + .sub, or their .ecm archives'),
      );
    case 'multipleCue':
      return new ValidationError(t('Several .cue files selected. Add one game at a time: one .cue and its .bin files.'));
    case 'multipleCcd':
      return new ValidationError(t('Several .ccd files selected. Add one game at a time: one .ccd with its .img and .sub.'));
    case 'cueRequired':
      return new ValidationError(t('Several .bin files need a .cue file that describes the tracks'));
    case 'missing':
      return new ValidationError(
        t('The disc image set is incomplete. Missing: {files}. An .img or .bin may also be selected as an .ecm archive.', {
          files: issue.files.join(', '),
        }),
      );
    case 'duplicate':
      return new ValidationError(t('The files {files} hold the same data — select only one of them', { files: issue.files.join(', ') }));
    case 'extra':
      return new ValidationError(
        t('The files {files} do not belong to this disc image — remove them from the selection', { files: issue.files.join(', ') }),
      );
  }
}

const inputAt = (inputs: InspectedSource[], index: number): InspectedSource => {
  const input = inputs[index];
  if (!input) throw new BadRequestError(t('No file selected'));
  return input;
};

/** A selected file as a part of the game file: an ECM archive is measured by the size of the data inside it. */
async function partOf(input: InspectedSource): Promise<GamePart> {
  if (input.ext !== 'ecm') return { input, fileName: input.fileName, ecm: false, size: input.size };
  const { size } = await scanEcm(input.abs, input.fileName);
  if (size === 0) throw new ValidationError(t('The ECM archive “{name}” is empty', { name: input.fileName }));
  return { input, fileName: discSetFile(input.fileName).unpacked, ecm: true, size };
}

const needsImg = (settings: Pick<Settings, 'extensions'>): boolean =>
  settings.extensions.length > 0 && !settings.extensions.includes('img');

function assertSectors(part: GamePart, sector: number, what: 'cue' | 'cd'): void {
  if (part.size % sector === 0) return;
  throw new ValidationError(
    what === 'cue'
      ? t(
          'The size of “{fileName}” is not a multiple of the sector size ({sector} bytes): the file is corrupted or does not match the .cue',
          { fileName: part.fileName, sector },
        )
      : t('The size of “{fileName}” is not a multiple of the CD sector size ({sector} bytes): the image is corrupted', {
          fileName: part.fileName,
          sector,
        }),
  );
}

/** A .cue with its .bin files (some may be ECM archives): merged into one .img in the order of the .cue. */
async function planBinCue(
  inputs: InspectedSource[],
  cueIndex: number,
  binIndexes: number[],
  settings: Pick<Settings, 'extensions'>,
  title: string,
): Promise<GamePlan> {
  const cueInput = inputAt(inputs, cueIndex);
  const cue = parseCue(await readCueText(cueInput.abs));
  if (!binIndexes.length) {
    throw new ValidationError(
      t('No .bin is selected for “{fileName}”. You need to select: {v1}', {
        fileName: cueInput.fileName,
        v1: cue.files.map((file) => file.name).join(', '),
      }),
    );
  }
  const bins: GamePart[] = [];
  for (const index of binIndexes) bins.push(await partOf(inputAt(inputs, index)));
  const ordered = pairBins(cue.files, bins);
  if (new Set(cue.files.map((file) => file.sector)).size > 1) {
    throw new ValidationError(t('Tracks with different sector sizes cannot be merged into one .img'));
  }
  ordered.forEach((bin, index) => assertSectors(bin, cue.files[index]?.sector ?? 1, 'cue'));

  const warnings: string[] = [];
  if (cue.tracks > 1) {
    warnings.push(
      t('The .cue has {tracks} tracks. Track boundaries are not preserved in a single .img', { tracks: cue.tracks }) +
        (cue.hasAudio ? t(', and audio tracks (CDDA) may not play.') : '.'),
    );
  }
  return {
    mode: 'disc',
    inputs,
    parts: ordered,
    companions: [],
    fileName: `${gameBaseName(title, discSetTitle(cueInput.fileName))}.img`,
    size: ordered.reduce((sum, bin) => sum + bin.size, 0),
    warnings,
    needsImgExtension: needsImg(settings),
  };
}

/** CloneCD (.ccd + .img + .sub, the .img maybe an ECM archive): the .img is the game file. */
async function planCloneCd(
  inputs: InspectedSource[],
  set: { ccd: number; img: number; sub: number | null },
  settings: Pick<Settings, 'extensions'>,
  title: string,
  keepCompanions: boolean,
): Promise<GamePlan> {
  const ccd = inputAt(inputs, set.ccd);
  if (!/^\s*\[CloneCD\]/im.test(await readCueText(ccd.abs))) {
    throw new ValidationError(t('“{name}” is not a CloneCD control file (no [CloneCD] section)', { name: ccd.fileName }));
  }
  const img = await partOf(inputAt(inputs, set.img));
  assertSectors(img, RAW_SECTOR, 'cd');
  const sub = set.sub === null ? null : inputAt(inputs, set.sub);
  const base = gameBaseName(title, discSetTitle(ccd.fileName));
  const warnings: string[] = [];
  const companions = keepCompanions
    ? [{ input: ccd, fileName: `${base}.ccd` }, ...(sub ? [{ input: sub, fileName: `${base}.sub` }] : [])]
    : [];
  if (keepCompanions && sub && sub.size !== (img.size / RAW_SECTOR) * SUB_SECTOR) {
    warnings.push(t('The size of “{name}” does not match the image: the subchannel data may be wrong', { name: sub.fileName }));
  }
  return {
    mode: 'clonecd',
    inputs,
    parts: [img],
    companions,
    fileName: `${base}.img`,
    size: img.size,
    warnings,
    needsImgExtension: needsImg(settings),
  };
}

/**
 * Analyzes the selected game files and decides what to do (see `detectDiscSet`):
 *  - one file: copied as is (mode "single");
 *  - one ECM archive: unpacked (mode "ecm"); a raw disc image (.bin, .img) becomes an .img;
 *  - a .cue and its .bin file(s) (or their .ecm archives): merged into one .img (mode "disc");
 *  - CloneCD .ccd + .img (or .img.ecm) + .sub: the .img is the game file (mode "clonecd").
 * One addition is one game.
 */
export async function planGame(
  sources: SourceRef[],
  settings: Pick<Settings, 'extensions'>,
  title = '',
  { keepCompanions = KEEP_CLONECD_COMPANIONS }: { keepCompanions?: boolean } = {},
): Promise<GamePlan> {
  if (!sources.length) throw new BadRequestError(t('No file selected'));
  if (sources.length > MAX_GAME_FILES)
    throw new ValidationError(t('Too many files (no more than {MAX_FILES})', { MAX_FILES: MAX_GAME_FILES }));

  const inputs: InspectedSource[] = [];
  for (const source of sources) inputs.push(await inspectSource(source, 'game', settings));
  const detected = detectDiscSet(inputs.map((input) => input.fileName));
  if (!detected.ok) throw discSetError(detected.issue);
  const { set } = detected;

  switch (set.kind) {
    case 'single': {
      const one = inputAt(inputs, set.file);
      assertAllowedExtension('game', one.ext, settings, { strict: true });
      return {
        mode: 'single',
        inputs,
        parts: [{ input: one, fileName: one.fileName, ecm: false, size: one.size }],
        companions: [],
        fileName: `${gameBaseName(title, discSetTitle(one.fileName))}${path.extname(one.fileName)}`,
        size: one.size,
        warnings: [],
        needsImgExtension: false,
      };
    }
    case 'ecm': {
      const one = inputAt(inputs, set.file);
      if (set.outputExt !== 'img') assertAllowedExtension('game', set.outputExt, settings, { strict: true });
      const part = await partOf(one);
      return {
        mode: 'ecm',
        inputs,
        parts: [part],
        companions: [],
        fileName: `${gameBaseName(title, discSetTitle(one.fileName))}.${set.outputExt}`,
        size: part.size,
        warnings: [],
        needsImgExtension: set.outputExt === 'img' && needsImg(settings),
      };
    }
    case 'bincue':
      return planBinCue(inputs, set.cue, set.bins, settings, title);
    case 'clonecd':
      return planCloneCd(inputs, set, settings, title, keepCompanions);
  }
}

/** A short description of the plan for the UI (no paths on disk). */
export const describePlan = (plan: GamePlan): PlanDescription => ({
  mode: plan.mode,
  outputName: plan.fileName,
  size: plan.size,
  files: plan.inputs.map((input) => ({ name: input.fileName, size: input.size })),
  warnings: plan.warnings,
});

export interface AddGameInput {
  game: SourceRef | SourceRef[];
  title: string;
  image: SourceRef | null;
  /** Pack the game file into `<title>.zip` (see `AddGameRequest.compress`). */
  compress?: boolean;
}

/**
 * Adds a game: copies the file into the games folder (or packs it into `<title>.zip` there) and the image into the
 * images folder (named after the game title), then adds an entry to the CSV. When anything fails, the files already
 * copied are removed.
 */
export function addGame({ game, title, image, compress: compressRequested = false }: AddGameInput): Promise<AddGameResponse> {
  return runExclusive(t('adding a game'), async () => {
    const settings = await getSettings();

    const cleanTitle = normalizeTitle(title);
    const short = toCamelCase(cleanTitle);

    if (!settings.gamesDir) throw new BadRequestError(t('Choose the games folder first'));
    assertNotMediaFolder(settings);
    await assertDirectory(settings.gamesDir, t('Games folder'));
    if (!settings.csvPath) throw new BadRequestError(t('Choose the CSV file first'));
    try {
      await fs.access(settings.gamesDir, fs.constants.W_OK);
    } catch (err) {
      throw fsError(err, t('games folder {gamesDir}', { gamesDir: settings.gamesDir }));
    }

    const plan = await planGame(Array.isArray(game) ? game : [game], settings, cleanTitle);
    /** A generated cover could not be made: the error goes to the log, the user gets a warning, the game is still added. */
    const coverFailed = (err: unknown, target: string): void => {
      logger.error({ err, target }, 'Cover: could not be created');
      const message = t('Cover could not be created: {message}', { message: errorMessage(err) });
      plan.warnings.push(message);
      journal('warn', message);
    };
    // A game that already is a .zip is copied as it is: an archive is not packed into another one.
    const compress = compressRequested && extOf(plan.fileName) !== 'zip';
    const device = deviceById(settings.device);
    if (compress && !canCompressToZip(device, settings.platform)) {
      throw new ValidationError(t('Games of the {platform} platform cannot be compressed to .zip', { platform: settings.platform }));
    }
    if (compress && plan.size > ZIP_MAX_BYTES)
      throw new ValidationError(t('The game file is larger than 4 GB and cannot be compressed to .zip'));
    // The name on the card (and in the CSV): `Game.gba` packed becomes `Game.zip` with `Game.gba` inside.
    const fileName = compress ? `${baseNoExt(plan.fileName)}.zip` : plan.fileName;
    const dest = path.join(settings.gamesDir, fileName);
    if (!isInside(settings.gamesDir, dest)) throw new PathTraversalError(t('The path goes outside the folder'));

    // Adding again: a file with this name is already in the folder (case does not matter).
    const existing = await listNames(settings.gamesDir).catch((err: unknown) => {
      throw fsError(err, t('reading the games folder'));
    });
    for (const name of [fileName, ...plan.companions.map((companion) => companion.fileName)]) {
      if (existing.some((other) => other.toLowerCase() === name.toLowerCase())) {
        throw new ConflictError(t('The game is already added: the file “{fileName}” exists in the games folder', { fileName: name }));
      }
    }

    // Same title: another CSV entry already has it.
    const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
    const lookup = csvLookup(csv, settings.csv.columns, settings.csv.pathPrefix);
    const relKey = fileName.toLowerCase();
    for (const [key, value] of lookup) {
      if (key !== relKey && value.name && value.name.toLowerCase() === cleanTitle.toLowerCase()) {
        throw new ConflictError(t('A game titled “{cleanTitle}” is already in the CSV ({key}). Change the title.', { cleanTitle, key }));
      }
    }

    // The cover: the picture the user chose or, without one, a generated box with the platform and the title.
    // Either way it is saved as `<title>.png` in the images folder.
    let img: { dir: string; name: string; png: Buffer; generated: boolean; stagedId: string | null } | null = null;
    const imgBase = toSafeFileName(cleanTitle);
    const imagesDir = settings.imagesDir || path.join(settings.gamesDir, 'images');
    const takenImage = async (): Promise<string | undefined> => {
      const names = await listNames(imagesDir).catch((err: unknown) => {
        throw fsError(err, t('reading the images folder'));
      });
      return names.find((name) => baseNoExt(name).toLowerCase() === imgBase.toLowerCase() && IMAGE_EXTENSIONS.includes(extOf(name)));
    };
    if (image) {
      const info = await inspectSource(image, 'image', settings);
      if (!imgBase) throw new ValidationError(t('An image file name cannot be built from this title — change the title'));
      const taken = await takenImage();
      if (taken)
        throw new ConflictError(
          t('The image “{taken}” already exists in the images folder. Change the title or delete the old image.', { taken }),
        );
      // Every cover is saved as PNG; a picture that cannot be converted stops the addition before anything is copied.
      img = { dir: imagesDir, name: `${imgBase}.png`, png: await convertToPng(info.abs), generated: false, stagedId: info.stagedId };
    } else if (imgBase) {
      // No picture chosen: a cover is drawn. A cover is a nicety — whatever goes wrong here, the game is still added.
      const target = path.join(imagesDir, `${imgBase}.png`);
      logger.info({ title: cleanTitle, platform: settings.platform, target }, 'Cover: no image chosen, generating one');
      try {
        const taken = await takenImage();
        if (taken) {
          // A picture with this name is already there: it becomes the cover of the game (found by the name), nothing is drawn.
          logger.info({ taken, imagesDir }, 'Cover: an image with this name already exists, nothing is generated');
          plan.warnings.push(t('The image “{taken}” is already in the images folder — it is used as the cover', { taken }));
        } else {
          const png = await renderCover({ title: cleanTitle, platform: settings.platform }, deviceById(settings.device));
          logger.info({ target, bytes: png.length }, 'Cover: rendered');
          img = { dir: imagesDir, name: `${imgBase}.png`, png, generated: true, stagedId: null };
        }
      } catch (err) {
        coverFailed(err, target);
      }
    }

    // The game file (an unpacked image is larger than its .ecm), its side files and the cover must fit on the card.
    await assertFreeSpace(
      settings.gamesDir,
      (compress ? zipSizeBound(plan.size, plan.fileName) : plan.size) +
        plan.companions.reduce((sum, companion) => sum + companion.input.size, 0) +
        (img?.png.length ?? 0),
    );

    const created: string[] = [];
    let write: { mode: 'added' | 'updated'; backupPath: string | null };
    try {
      // One pass: plain parts are copied, ECM archives are unpacked straight into the game file (no temporary copies);
      // when the game is compressed, the same data goes through deflate into the .zip.
      const phaseOf = (index: number): AddPhase =>
        compress ? 'compressing' : plan.parts[index]?.ecm ? 'unpacking' : plan.mode === 'single' ? 'copying' : 'building';
      setAddProgress(phaseOf(0), 0);
      const sources = plan.parts.map((part) => ({ path: part.input.abs, name: part.input.fileName, ecm: part.ecm }));
      const progress = (written: number, index: number): void => setAddProgress(phaseOf(index), plan.size ? written / plan.size : 1);
      if (!compress && plan.mode === 'single') {
        await buildAtomic(sources, dest, plan.size, progress); // a plain copy straight onto the card
      } else {
        // A conversion (ECM unpacking, BIN/CUE merging, ZIP packing) is made in the temp folder of the computer; only
        // the finished file is copied onto the card (still through a short-lived .part file, so no half-written game
        // file can ever appear under its real name). The temp folder is removed whatever happens.
        await withTempDir(async (tmp) => {
          const built = path.join(tmp, fileName);
          await assertFreeSpace(tmp, compress ? zipSizeBound(plan.size, plan.fileName) : plan.size);
          if (compress) await zipAtomic(sources, plan.fileName, built, plan.size, progress);
          else await buildAtomic(sources, built, plan.size, progress);
          const size = (await fs.stat(built)).size;
          setAddProgress('copying', 0);
          await copyAtomic(built, dest, size, (written) => setAddProgress('copying', size ? written / size : 1));
        });
      }
      created.push(dest);
      for (const companion of plan.companions) {
        const target = path.join(settings.gamesDir, companion.fileName);
        await copyAtomic(companion.input.abs, target, companion.input.size);
        created.push(target);
      }
      if (img?.generated) {
        // A generated cover that cannot be written (read-only folder, …) does not cancel the addition.
        const imageDest = path.join(img.dir, img.name);
        try {
          await fs.mkdir(img.dir, { recursive: true });
          await writePng(imageDest, img.png);
          created.push(imageDest);
          logger.info({ path: imageDest }, 'Cover: saved');
        } catch (err) {
          coverFailed(err, imageDest);
          img = null;
        }
      } else if (img) {
        await fs.mkdir(img.dir, { recursive: true });
        const imageDest = path.join(img.dir, img.name);
        await writePng(imageDest, img.png);
        created.push(imageDest);
      }
      const { csv: next, mode } = upsertGame(csv, settings.csv.columns, settings.csv.pathPrefix, {
        rel: fileName,
        name: cleanTitle,
        short,
      });
      write = { mode, backupPath: await writeCsv(settings.csvPath, next) };
    } catch (err) {
      for (const file of created.reverse()) await fs.rm(file, { force: true }).catch(() => undefined);
      journal('error', t('Game “{cleanTitle}” was not added: {message}', { cleanTitle, message: errorMessage(err) }));
      throw fsError(err, t('could not copy the file'));
    } finally {
      clearAddProgress();
    }

    for (const source of [...plan.inputs, img]) if (source?.stagedId) await discardStaged(source.stagedId);

    // The console's list of every game (allfiles.lst) gets the new game; favorites and recent games do not.
    const lists = await updateConsoleLists(settings, {
      kind: 'put',
      game: { platform: settings.platform, rel: fileName, title: cleanTitle, short },
      add: true,
    });
    plan.warnings.push(...lists.warnings);
    const listErrors = lists.errors;

    // The resulting .img or .zip must be in the list of game extensions, otherwise it would not show up after scanning.
    const resultExt = compress ? 'zip' : plan.needsImgExtension ? 'img' : null;
    const missingExt = resultExt && settings.extensions.length > 0 && !settings.extensions.includes(resultExt) ? resultExt : null;
    let extensionsChanged = false;
    if (missingExt) {
      try {
        await patchInternal((s) => {
          s.extensions = [...new Set([...s.extensions, missingExt])];
        });
        extensionsChanged = true;
        journal('info', t('The .{ext} extension was added to the list of game files', { ext: missingExt }));
      } catch (err) {
        plan.warnings.push(
          t('Could not add .{ext} to the extensions list ({message}) — add it in “Settings → Extensions”.', {
            ext: missingExt,
            message: errorMessage(err),
          }),
        );
      }
    }
    invalidateScan();
    journal(
      'success',
      t('Game added “{cleanTitle}”: {dest}', { cleanTitle, dest }) +
        (plan.mode === 'disc' ? t(' (image built from {length} .bin/.cue file(s))', { length: plan.inputs.length }) : '') +
        (plan.mode === 'clonecd' ? t(' (image from a CloneCD set)') : '') +
        (plan.parts.some((part) => part.ecm) ? t(' (unpacked from ECM)') : '') +
        (compress ? t(' (compressed to .zip, inside: {name})', { name: plan.fileName }) : '') +
        (img
          ? img.generated
            ? t('; generated cover: {v0}', { v0: path.join(img.dir, img.name) })
            : t('; image: {v0}', { v0: path.join(img.dir, img.name) })
          : '') +
        (write.mode === 'updated' ? t(' (CSV entry updated)') : ''),
    );
    return {
      rel: fileName,
      title: cleanTitle,
      short,
      size: plan.size,
      imageName: img?.name ?? null,
      imageGenerated: img?.generated ?? false,
      mode: plan.mode,
      compressed: compress,
      warnings: plan.warnings,
      listErrors,
      extensionsChanged,
      csv: { mode: write.mode, backupPath: write.backupPath },
    };
  });
}
