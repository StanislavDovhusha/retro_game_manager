import { hasUnsupportedChars } from '../../shared/gameName.ts';
import { findInvalidTag, MAX_TAG_LENGTH, MAX_TAGS, normalizeTags } from '../../shared/tags.ts';
import path from 'node:path';
import { t } from '../i18n/index.ts';
import type { UpdateEntryRequest, UpdateEntryResponse } from '../models/index.ts';
import { BadRequestError, ValidationError } from '../utils/errors.ts';
import { runExclusive } from '../utils/lock.ts';
import { assertNotProtected, baseNoExt, normalizeRel, safeResolveExisting } from '../utils/paths.ts';
import { normalizeTitle, toCamelCase } from '../utils/text.ts';
import { csvLookup, updateEntryFields, upsertGame } from './csv/plan.ts';
import { readCsv, writeCsv } from './csv/store.ts';
import { journal } from './journalService.ts';
import { invalidateScan } from './libraryService.ts';
import { renameGame } from './renameService.ts';
import { getSettings } from './settingsService.ts';
import { csvReadOptions } from './deviceService.ts';
import { updateConsoleLists } from './consoleLists.ts';

const MAX_SHORT_LENGTH = 128;

/** A short title is a single word: not empty, no whitespace or control characters. */
export function normalizeShort(value: string): string {
  const short = value.trim();
  if (!short) throw new ValidationError(t('The short name cannot be empty'));
  if (short.length > MAX_SHORT_LENGTH) throw new ValidationError(t('The short name is too long (128 characters maximum)'));
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is being rejected
  if (/[\s\u0000-\u001f]/u.test(short)) throw new ValidationError(t('The short name cannot contain spaces'));
  // "|" separates the fields of the console's game lists (allfiles.lst …).
  if (short.includes('|')) throw new ValidationError(t('The short name cannot contain the “|” character'));
  if (hasUnsupportedChars(short)) {
    throw new ValidationError(t('The short name can contain only English letters, digits and the signs - _ ( ) [ ] . & # :'));
  }
  return short;
}

/** Tags typed by the user: no tag may contain a space (it separates tags); empty tags and duplicates are dropped. */
export function validateTags(tags: readonly string[]): string[] {
  const bad = findInvalidTag(tags);
  if (bad?.reason === 'space') {
    throw new ValidationError(t('A tag cannot contain a space — a space separates the tags: “{tag}”', { tag: bad.tag }));
  }
  if (bad)
    throw new ValidationError(t('A tag is too long (the maximum is {max} characters): “{tag}”', { max: MAX_TAG_LENGTH, tag: bad.tag }));
  const clean = normalizeTags(tags);
  if (clean.length > MAX_TAGS) throw new ValidationError(t('Too many tags (no more than {max})', { max: MAX_TAGS }));
  return clean;
}

/**
 * Changes the CSV entry of a game from the table: the title, the short title and the tags.
 *
 * - Only the short title or the tags (or a title that stays the same): the CSV is changed once, with a backup.
 * - A changed title renames everything that belongs to the game exactly like "Rename game" does: the game file, the
 *   cover, the saves and states, the lists and the CSV. The new names are checked before anything is touched, and
 *   when a step fails everything already done is rolled back.
 * - A game that is not in the CSV yet gets an entry.
 */
export async function updateEntry(request: UpdateEntryRequest): Promise<UpdateEntryResponse> {
  const { rel, name, short: shortInput, tags: tagsInput, confirmed } = request;
  if (name === undefined && shortInput === undefined && tagsInput === undefined) throw new BadRequestError(t('Nothing to change'));
  const title = name === undefined ? undefined : normalizeTitle(name);
  const short = shortInput === undefined ? undefined : normalizeShort(shortInput);
  const tags = tagsInput === undefined ? undefined : validateTags(tagsInput);

  const settings = await getSettings();
  if (!settings.gamesDir) throw new BadRequestError(t('Choose the games folder first'));
  if (!settings.csvPath) throw new BadRequestError(t('Choose the CSV file first'));
  const abs = await safeResolveExisting(settings.gamesDir, rel);
  assertNotProtected(abs);
  const relNorm = normalizeRel(rel);
  const stem = baseNoExt(path.basename(abs));

  const csv = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
  const current = csvLookup(csv, settings.csv.columns, settings.csv.pathPrefix).get(relNorm.toLowerCase());
  const currentTitle = current?.name || stem;

  if (title !== undefined && title !== currentTitle) {
    if (confirmed !== true) throw new ValidationError(t('Renaming requires confirmation'));
    const renamed = await renameGame({ rel: relNorm, title, short, tags, createEntry: true });
    return {
      rel: renamed.newRel,
      title: renamed.title,
      short: renamed.short,
      tags: tags ?? current?.tags ?? [],
      renamed: true,
      warnings: renamed.warnings,
      listErrors: renamed.listErrors ?? [],
      csvBackupPath: renamed.csvBackupPath,
    };
  }

  return runExclusive(t('editing a game'), async () => {
    // Read again inside the lock: the table may have been changed while we waited.
    const fresh = await readCsv(settings.csvPath, csvReadOptions(settings), { allowMissing: true });
    const entry = csvLookup(fresh, settings.csv.columns, settings.csv.pathPrefix).get(relNorm.toLowerCase());
    const fields = { name: title, short, tags };
    let next;
    if (entry) {
      next = updateEntryFields(fresh, settings.csv.columns, settings.csv.pathPrefix, relNorm, fields).csv;
    } else {
      const entryTitle = title ?? stem;
      next = upsertGame(fresh, settings.csv.columns, settings.csv.pathPrefix, {
        rel: relNorm,
        name: entryTitle,
        short: short ?? toCamelCase(entryTitle),
        tags,
      }).csv;
    }
    const csvBackupPath = await writeCsv(settings.csvPath, next);
    invalidateScan();
    journal('success', t('Game data changed in the CSV: “{rel}” (backup: {csvBackupPath})', { rel: relNorm, csvBackupPath }));
    const finalTitle = title ?? (entry?.name || stem);
    const finalShort = short ?? entry?.short ?? toCamelCase(title ?? stem);
    // A new short name changes fields 4 and 5 of the game's line in every console list (the tags are not there).
    const warnings: string[] = [];
    let listErrors: string[] = [];
    if (short !== undefined && short !== entry?.short) {
      const lists = await updateConsoleLists(settings, {
        kind: 'put',
        game: { platform: settings.platform, rel: relNorm, title: finalTitle, short: finalShort },
        add: false,
      });
      warnings.push(...lists.warnings);
      listErrors = lists.errors;
    }
    return {
      rel: relNorm,
      title: finalTitle,
      short: finalShort,
      tags: tags ?? entry?.tags ?? [],
      renamed: false,
      warnings,
      listErrors,
      csvBackupPath,
    };
  });
}
