import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import iconv from 'iconv-lite';
import { t } from '../../i18n/index.ts';
import type { CsvReadOptions, CsvTable } from '../../models/index.ts';
import { atomicWrite } from '../../utils/atomicWrite.ts';
import { BadRequestError, InternalError, UnprocessableError } from '../../utils/errors.ts';
import { errorCode, errorMessage } from '../../utils/guards.ts';
import { assertNotProtected, statOrNull } from '../../utils/paths.ts';
import { backupFile } from '../backupService.ts';

/** Columns assumed when the file has no header: path, full title, short title. */
const DEFAULT_WIDTH = 3;
/** A new file also gets the (empty) tags column. */
const NEW_WIDTH = 4;

const columnLabel = (index: number): string => t('Column {v0}', { v0: index + 1 });

/**
 * Reads a CSV. The structure is not assumed: the result holds the headers (or "Column N" when there is no header)
 * and the rows as arrays, so all extra fields are preserved.
 */
export async function readCsv(
  csvPath: string,
  { delimiter = ',', encoding = 'utf8', hasHeader = false, newFile = { bom: true, eol: '\r\n' } }: Partial<CsvReadOptions> = {},
  { allowMissing = false }: { allowMissing?: boolean } = {},
): Promise<CsvTable> {
  let buf: Buffer;
  try {
    buf = await fs.readFile(csvPath);
  } catch (err) {
    if (errorCode(err) === 'ENOENT' && allowMissing) {
      // The file does not exist yet: work with an empty table, the file is created on the first write — in the format
      // of the console's own list (from its profile: UTF-8 with a BOM and CRLF line ends on the current models), with the columns
      // path / title / short title / tags.
      const headers = hasHeader ? [] : Array.from({ length: NEW_WIDTH }, (_, i) => columnLabel(i));
      return {
        headers,
        rows: [],
        hasHeader,
        hadBom: encoding === 'utf8' && newFile.bom,
        eol: newFile.eol,
        delimiter,
        encoding,
        exists: false,
      };
    }
    throw new BadRequestError(t('Could not read the CSV file: {message}', { message: errorMessage(err) }), { cause: err });
  }

  const hadBom =
    (encoding === 'utf8' && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) ||
    (encoding === 'utf16le' && buf[0] === 0xff && buf[1] === 0xfe);
  const text = iconv.decode(buf, encoding);
  // A file without any line break (empty, or a lone BOM) gets the line ends of the console's own files.
  const eol = text.includes('\r\n') ? '\r\n' : text.includes('\n') ? '\n' : newFile.eol;

  let rows: string[][];
  try {
    rows = parse(text, {
      delimiter,
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
    });
  } catch (err) {
    throw new UnprocessableError(
      t('The CSV could not be parsed (check the delimiter and encoding): {message}', { message: errorMessage(err) }),
      { cause: err },
    );
  }

  let headers: string[];
  const first = hasHeader ? rows.shift() : undefined;
  if (first) headers = first.map((header) => String(header).trim());
  else if (hasHeader) headers = [];
  else {
    // An empty file (or one holding only a BOM) still has the default columns: path, title, short title.
    const width = rows.reduce((max, row) => Math.max(max, row.length), DEFAULT_WIDTH);
    headers = Array.from({ length: width }, (_, i) => columnLabel(i));
  }
  return { headers, rows, hasHeader, hadBom, eol, delimiter, encoding, exists: true };
}

export function serializeCsv(csv: CsvTable): Buffer {
  const records = csv.hasHeader && csv.headers.length ? [csv.headers, ...csv.rows] : csv.rows;
  const text = stringify(records, { delimiter: csv.delimiter, record_delimiter: csv.eol === '\r\n' ? 'windows' : 'unix' });
  return iconv.encode(text, csv.encoding, { addBOM: csv.hadBom });
}

/**
 * Safe write: backup -> temporary file -> replace. The backup goes to the data folder on the computer
 * (`backups/<card id>/<platform>/filelist.csv.bak-<time>`), never next to the CSV on the card.
 */
export async function writeCsv(csvPath: string, csv: CsvTable): Promise<string | null> {
  assertNotProtected(csvPath);
  let backupPath: string | null = null;
  if (await statOrNull(csvPath)) {
    try {
      backupPath = await backupFile(csvPath);
    } catch (err) {
      throw new InternalError(t('Could not create a CSV backup; the file was not changed: {message}', { message: errorMessage(err) }), {
        cause: err,
      });
    }
  }
  try {
    await atomicWrite(csvPath, serializeCsv(csv));
  } catch (err) {
    throw new InternalError(
      t('Could not save the CSV (the original file is untouched, backup: {v0}): {message}', {
        v0: backupPath ?? t('not needed'),
        message: errorMessage(err),
      }),
      { cause: err },
    );
  }
  return backupPath;
}
