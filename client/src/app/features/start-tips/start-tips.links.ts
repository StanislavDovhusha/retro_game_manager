/**
 * Links of the start-screen tips that do not depend on the console (disk tools). The firmware and community links of
 * a console are in its profile (`tips.firmwareLink`, `tips.communityLink` in `devices/*.json`). The tips' texts are in the dictionaries (`startTips.*`).
 * A link with an empty `url` is not shown. The links open in the system browser (in the desktop app, through the
 * window's open handler; in the browser, in a new tab).
 */

export interface TipLink {
  /** Shown as the link text: a program or site name, the same in every language. */
  readonly name: string;
  readonly url: string;
}

export const TIP_LINKS = {
  win32DiskImager: { name: 'Win32 Disk Imager', url: 'https://sourceforge.net/projects/win32diskimager/' },
  applePiBaker: { name: 'ApplePiBaker', url: 'https://www.tweaking4all.com/software/macosx-software/applepi-baker-v2/' },
  testDisk: { name: 'TestDisk', url: 'https://www.cgsecurity.org/wiki/TestDisk' },
  photoRec: { name: 'PhotoRec', url: 'https://www.cgsecurity.org/wiki/PhotoRec' },
  sdCardFormatter: { name: 'SD Card Formatter', url: 'https://www.sdcard.org/downloads/formatter/' },
  balenaEtcher: { name: 'balenaEtcher', url: 'https://etcher.balena.io/' },
} as const satisfies Record<string, TipLink>;

export type TipLinkId = keyof typeof TIP_LINKS;

/**
 * A page of a console profile as a link, named by its address without the scheme and the closing slash
 * (`handhelds.wiki/SF3000`); null for an empty or broken address.
 */
export function pageLink(url: string): TipLink | null {
  try {
    if (!url) return null;
    const { hostname, pathname, search } = new URL(url);
    return { name: `${hostname}${pathname}${search}`.replace(/\/$/, ''), url };
  } catch {
    return null;
  }
}

/** A piece of a tip's text: plain text, or a link put in place of a `{{name}}` placeholder. */
export type TextPart = { readonly text: string; readonly link?: undefined } | { readonly text?: undefined; readonly link: TipLink };

/**
 * Splits a translated text at its `{{name}}` placeholders, so that the links can be drawn inside the sentence (the
 * translator decides where they go). A placeholder without a link stays as it is.
 */
export function linkedText(text: string, links: Readonly<Record<string, TipLink | null>>): TextPart[] {
  const parts: TextPart[] = [];
  let start = 0;
  for (const match of text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)) {
    const link = links[match[1] ?? ''];
    if (!link) continue;
    if (match.index > start) parts.push({ text: text.slice(start, match.index) });
    parts.push({ link });
    start = match.index + match[0].length;
  }
  if (start < text.length) parts.push({ text: text.slice(start) });
  return parts;
}

/** The links that are filled in, in the order asked for; empty ones are left out. */
export const tipLinks = (...ids: TipLinkId[]): TipLink[] => ids.map((id): TipLink => TIP_LINKS[id]).filter((link) => link.url !== '');
