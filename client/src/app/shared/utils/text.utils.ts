// The same rules as on the server (src/utils/text.ts): here they only drive form hints,
// the server always builds the final values itself.

/** "The Legend of Zelda" → "theLegendOfZelda". */
export function toCamelCase(text: string): string {
  const words = text.normalize('NFC').replace(/['’ʼ`]/g, '').match(/[\p{L}\p{N}]+/gu) ?? [];
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/** A safe file name built from a game title (an empty string means the title is not usable). */
export function toSafeFileName(text: string, max = 150): string {
  const trim = (s: string) => s.replace(/^[. ]+/, '').replace(/[. ]+$/, '');
  let name = trim(text.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' '));
  if (name.length > max) name = trim(name.slice(0, max));
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `_${name}`;
  return name;
}

export const fileExt = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
};

export const stripExt = (name: string): string => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
};

export const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;
