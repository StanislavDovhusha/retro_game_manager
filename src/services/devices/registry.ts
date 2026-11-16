import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { DeviceProfile, DeviceSummary } from '../../../shared/devices.ts';
import { config } from '../../config/index.ts';
import { errorMessage } from '../../utils/guards.ts';
import { logger } from '../../utils/logger.ts';
import { findProjectRoot } from '../../utils/projectRoot.ts';

/**
 * The console models. Every `*.json` file of the `devices/` folder of the application is a profile, and so is every
 * one in `<data folder>/devices/` (the user's own models; a file there with the id of a built-in one replaces it).
 * A profile may `extend` another one (models with the same card layout share an abstract base): objects are merged
 * key by key, lists and values replace the parent's. A broken profile is skipped with a warning in the log.
 *
 * Adding a console is adding a profile: nothing in the code names a model.
 */

export const DEFAULT_DEVICE_ID = 'sf3000';

const folderName = z
  .string()
  .min(1)
  .max(128)
  .refine((name) => !/[\\/]/.test(name) && name !== '.' && name !== '..', 'a folder name without slashes');
const relativeFile = z
  .string()
  .max(256)
  .refine((name) => !name.startsWith('/') && !name.split(/[\\/]/).includes('..'), 'a path inside the folder');
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'a color like #1a2b3c');
const webPage = z.string().refine((url) => url === '' || /^https:\/\//.test(url), 'an https:// address or ""');

const platformSchema = z
  .object({
    folder: folderName,
    name: z.string().min(1).max(128),
    zip: z.boolean().default(true),
    system: z.string().min(1).max(32).optional(),
    cover: z.object({ from: color, to: color, accent: color, text: color.default('#ffffff') }).strict(),
  })
  .strict();

/** A complete profile (after inheritance). */
const profileSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'lower-case letters, digits and dashes'),
    name: z.string().min(1).max(64),
    order: z.number().default(1000),
    abstract: z.boolean().default(false),
    detect: z
      .object({ anyOf: z.array(folderName).default([]), allOf: z.array(folderName).default([]) })
      .strict()
      .prefault({}),
    folders: z.object({ system: z.array(folderName), saves: z.union([folderName, z.literal('')]), media: z.array(folderName) }).strict(),
    saves: z
      .object({
        saves: z.union([folderName, z.literal('')]),
        states: z.union([folderName, z.literal('')]),
        lists: z.array(relativeFile),
        mainList: z.union([relativeFile, z.literal('')]).default(''),
        listFormat: z
          .object({
            separator: z.string().length(1),
            fields: z.array(z.enum(['path', 'title', 'titleUpper', 'short', 'shortUpper'])).min(1),
          })
          .strict()
          .refine((format) => format.fields[0] === 'path', 'the first field must be "path" (lines are found by it)')
          .default({ separator: '|', fields: ['path', 'title', 'titleUpper', 'short', 'shortUpper'] }),
        cores: relativeFile,
      })
      .strict()
      .refine((saves) => saves.mainList === '' || saves.lists.includes(saves.mainList), 'saves.mainList must be one of saves.lists'),
    csv: z
      .object({
        fileName: folderName.refine((name) => name.toLowerCase().endsWith('.csv'), 'a .csv file name'),
        delimiter: z.enum([',', ';', '\t']),
        encoding: z.string().min(1),
        header: z.boolean(),
        bom: z.boolean(),
        lineEnding: z.enum(['crlf', 'lf']),
      })
      .strict(),
    covers: z
      .object({ folder: folderName, width: z.number().int().min(32).max(4096), height: z.number().int().min(32).max(4096) })
      .strict(),
    extensions: z.array(z.string().regex(/^[a-z0-9]{1,16}$/i)).min(1),
    platforms: z.array(platformSchema),
    tips: z
      .object({ cpu: z.string().max(64), incompatibleFirmware: z.string().max(200), firmwareLink: webPage, communityLink: webPage })
      .strict()
      .default({ cpu: '', incompatibleFirmware: '', firmwareLink: '', communityLink: '' }),
  })
  .passthrough();

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The parent's values with the child's on top: objects key by key, anything else (lists too) replaced. */
export function mergeProfile(parent: Raw, child: Raw): Raw {
  const out: Raw = { ...parent };
  for (const [name, value] of Object.entries(child)) {
    out[name] = isObject(value) && isObject(parent[name]) ? mergeProfile(parent[name] as Raw, value) : value;
  }
  return out;
}

export interface LoadedDevices {
  devices: DeviceProfile[];
  problems: string[];
}

/**
 * Resolves the inheritance of raw profiles (keyed by file id) and checks them. Pure (no files): the loader feeds it,
 * the tests call it directly. Abstract profiles are kept for inheritance but not returned.
 */
export function resolveProfiles(raw: ReadonlyMap<string, Raw>): LoadedDevices {
  const problems: string[] = [];
  const resolved = new Map<string, Raw | null>();
  const resolve = (id: string, chain: string[]): Raw | null => {
    if (resolved.has(id)) return resolved.get(id) ?? null;
    const own = raw.get(id);
    if (!own) return null;
    if (chain.includes(id)) {
      problems.push(`${id}: circular "extends" (${[...chain, id].join(' → ')})`);
      return null;
    }
    let full: Raw = own;
    const parentId = own['extends'];
    if (parentId !== undefined) {
      if (typeof parentId !== 'string' || !raw.has(parentId)) {
        problems.push(`${id}: "extends" names an unknown profile (${String(parentId)})`);
        resolved.set(id, null);
        return null;
      }
      const parent = resolve(parentId, [...chain, id]);
      if (!parent) {
        problems.push(`${id}: its parent profile ${parentId} is broken`);
        resolved.set(id, null);
        return null;
      }
      // What is never inherited: the identity of the parent and its being abstract.
      const { id: _id, name: _name, abstract: _abstract, order: _order, ...inherited } = parent;
      full = mergeProfile(inherited, own);
    }
    delete full['extends'];
    delete full['$comment'];
    resolved.set(id, full);
    return full;
  };

  const devices: DeviceProfile[] = [];
  for (const id of raw.keys()) {
    const full = resolve(id, []);
    if (!full) continue;
    if (full['id'] !== id) {
      problems.push(`${id}: the "id" inside (${String(full['id'])}) must equal the file name`);
      continue;
    }
    const checked = profileSchema.safeParse(full);
    if (!checked.success) {
      problems.push(`${id}: ${checked.error.issues.map((issue) => `${issue.path.join('.') || 'profile'} — ${issue.message}`).join('; ')}`);
      continue;
    }
    const { abstract, ...profile } = checked.data;
    if (abstract) continue;
    devices.push({
      id: profile.id,
      name: profile.name,
      order: profile.order,
      detect: profile.detect,
      folders: profile.folders,
      saves: profile.saves,
      csv: profile.csv,
      covers: profile.covers,
      extensions: [...new Set(profile.extensions.map((ext) => ext.toLowerCase()))],
      platforms: profile.platforms.map((platform) => ({ ...platform, system: platform.system ?? platform.folder.toUpperCase() })),
      tips: profile.tips,
    });
  }
  devices.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return { devices, problems };
}

/** Reads the `*.json` files of a folder; a missing folder is no profile. Later folders replace earlier ids. */
async function readFolder(dir: string, into: Map<string, Raw>, problems: string[]): Promise<void> {
  let names: string[];
  try {
    names = (await fs.readdir(dir)).filter((name) => name.toLowerCase().endsWith('.json'));
  } catch {
    return;
  }
  for (const name of names.sort()) {
    const id = name.slice(0, -'.json'.length);
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(path.join(dir, name), 'utf8'));
      if (!isObject(parsed)) throw new Error('not a JSON object');
      into.set(id, parsed);
    } catch (err) {
      problems.push(`${path.join(dir, name)}: ${errorMessage(err)}`);
    }
  }
}

async function loadDevices(): Promise<DeviceProfile[]> {
  const root = await findProjectRoot(import.meta.url);
  const raw = new Map<string, Raw>();
  const problems: string[] = [];
  await readFolder(path.join(root, 'devices'), raw, problems);
  await readFolder(path.join(config.dataDir, 'devices'), raw, problems);
  const result = resolveProfiles(raw);
  for (const problem of [...problems, ...result.problems]) logger.warn({ problem }, 'Device profile skipped');
  if (!result.devices.length) throw new Error(`No usable console profile was found in ${path.join(root, 'devices')}`);
  return result.devices;
}

// The profiles are read once, when the server modules are loaded (they are needed by synchronous path checks).
const devices = await loadDevices();

/** Every model, in display order. */
export const allDevices = (): readonly DeviceProfile[] => devices;

export const listDevices = (): DeviceSummary[] => devices.map(({ id, name }) => ({ id, name }));

/** A model by id; an unknown id (a removed profile, a damaged setting) gives the default model. */
export function deviceById(id: string | null | undefined): DeviceProfile {
  return devices.find((device) => device.id === id) ?? devices.find((device) => device.id === DEFAULT_DEVICE_ID) ?? devices[0]!;
}

export const isDeviceId = (id: unknown): id is string => typeof id === 'string' && devices.some((device) => device.id === id);

/**
 * Folder names that are system folders on any known model (lower case). The path checks use all of them, whatever
 * model is chosen: a card is protected even when the wrong model is selected.
 */
export const systemFolderNames: ReadonlySet<string> = new Set(
  devices.flatMap((device) => device.folders.system.map((name) => name.toLowerCase())),
);

/** Root folders by which a card of a known model is recognized (lower case): the folder dialogs look for them. */
export const cardMarkerNames: readonly string[] = [
  ...new Set(devices.flatMap((device) => [...device.detect.anyOf, ...device.detect.allOf].map((name) => name.toLowerCase()))),
];

/**
 * Which model a card is, from the names in its root (lower case). The model whose markers match best wins; when
 * several match equally (models with the same card layout), the preferred one (the model chosen in the settings) is
 * kept if it is among them, otherwise the first of them. Null when no model recognizes the card.
 */
export function detectDevice(
  rootNames: ReadonlySet<string>,
  preferred: string,
  candidates: readonly DeviceProfile[] = devices,
): { id: string; ambiguous: boolean } | null {
  let best: DeviceProfile[] = [];
  let bestScore = 0;
  for (const device of candidates) {
    const all = device.detect.allOf.map((name) => name.toLowerCase());
    const any = device.detect.anyOf.map((name) => name.toLowerCase());
    if (!all.length && !any.length) continue;
    if (!all.every((name) => rootNames.has(name))) continue;
    const anyHits = any.filter((name) => rootNames.has(name)).length;
    if (any.length && !anyHits) continue;
    const score = all.length + anyHits;
    if (score > bestScore) {
      best = [device];
      bestScore = score;
    } else if (score === bestScore) best.push(device);
  }
  if (!best.length) return null;
  const chosen = best.find((device) => device.id === preferred) ?? best[0]!;
  return { id: chosen.id, ambiguous: best.length > 1 };
}
