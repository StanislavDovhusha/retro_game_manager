import fs from 'node:fs/promises';
import path from 'node:path';
import type { Stats } from 'node:fs';
import { systemFolderNames } from '../services/devices/registry.ts';
import { t } from '../i18n/index.ts';
import { BadRequestError, ForbiddenError, NotFoundError, PathTraversalError, ValidationError } from './errors.ts';

/** Normalizes a path to the form `a/b/c.ext` (forward slashes, no leading slash, NFC). */
export function normalizeRel(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^(\.\/|\/)+/, '')
    .replace(/\/{2,}/g, '/')
    .normalize('NFC');
}

export const extOf = (name: string): string => path.extname(name).slice(1).toLowerCase();
export const baseNoExt = (name: string): string => name.slice(0, name.length - path.extname(name).length);

/** True if `target` is strictly inside `root` (the root itself does not count). */
export function isInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Checks a client-supplied relative path without touching the disk: it must be a non-empty string without NUL
 * bytes, must not be absolute (also in the Windows `C:\` form) and must not contain `..` segments.
 * Returns the normalized path.
 */
export function assertSafeRelative(rel: unknown): string {
  if (typeof rel !== 'string' || !rel || rel.includes('\0')) {
    throw new ValidationError(t('Invalid file path'));
  }
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
    throw new PathTraversalError(t('The path goes outside the folder'), undefined, 400);
  }
  const clean = normalizeRel(rel);
  if (!clean) throw new ValidationError(t('Invalid file path'));
  if (clean.split('/').some((segment) => segment === '..')) {
    throw new PathTraversalError(t('The path goes outside the folder'), undefined, 400);
  }
  return clean;
}

/**
 * Safely turns a relative path into an absolute one inside `root`.
 * Path traversal protection: `..`, absolute paths and NUL bytes are rejected.
 */
export function safeResolve(root: string, rel: unknown): string {
  if (!root) throw new BadRequestError(t('No folder selected'));
  const clean = assertSafeRelative(rel);
  const abs = path.resolve(root, clean);
  if (!isInside(root, abs)) throw new PathTraversalError(t('The path goes outside the folder'));
  return abs;
}

/** Same as `safeResolve`, but also follows symlinks and checks that the file exists and stays inside `root`. */
export async function safeResolveExisting(root: string, rel: unknown): Promise<string> {
  const abs = safeResolve(root, rel);
  let real: string;
  try {
    real = await fs.realpath(abs);
  } catch {
    throw new NotFoundError(t('File not found'));
  }
  const realRoot = await fs.realpath(root);
  if (!isInside(realRoot, real)) throw new PathTraversalError(t('The file is outside the selected folder'));
  return abs;
}

/**
 * Checks an absolute path that came from the client: it must be absolute, free of NUL bytes and, when a root
 * is given (the SD card root), strictly inside it. Returns the resolved path.
 */
export function assertAbsoluteInside(value: unknown, root: string | null, label: string): string {
  if (typeof value !== 'string' || !value || value.includes('\0') || !path.isAbsolute(value)) {
    throw new ValidationError(t('{label}: an absolute path is required', { label }));
  }
  const abs = path.resolve(value);
  if (root && abs !== path.resolve(root) && !isInside(root, abs)) {
    throw new PathTraversalError(t('{label}: the path must be inside the SD card root — {value}', { label, value: abs }));
  }
  return abs;
}

export async function statOrNull(target: string): Promise<Stats | null> {
  try {
    return await fs.stat(target);
  } catch {
    return null;
  }
}

export async function assertDirectory(target: string, label: string): Promise<void> {
  const st = await statOrNull(target);
  if (!st?.isDirectory()) {
    throw new BadRequestError(t('{label}: folder not found or unavailable — {p}', { label, p: target }));
  }
}

export async function assertFile(target: string, label: string): Promise<void> {
  const st = await statOrNull(target);
  if (!st?.isFile()) {
    throw new BadRequestError(t('{label}: file not found or unavailable — {p}', { label, p: target }));
  }
}

/**
 * System folders of the card (`rootfs`, `cubegm`, … — those of every console profile): the application never changes
 * their contents (it only reads them). Only renaming a game updates the saves and lists of the saves folder.
 */
export const isProtectedName = (name: unknown): boolean => systemFolderNames.has(String(name ?? '').toLowerCase());

/** True if the path (absolute or relative) contains a system folder segment. */
export const hasProtectedSegment = (value: unknown): boolean =>
  String(value ?? '')
    .split(/[\\/]+/)
    .some(isProtectedName);

/** Throws 403 for paths inside system folders. Call it before any write or delete. */
export function assertNotProtected(value: unknown): void {
  if (hasProtectedSegment(value)) {
    throw new ForbiddenError(t('System folders of the console cannot be modified: {p}', { p: String(value) }));
  }
}
