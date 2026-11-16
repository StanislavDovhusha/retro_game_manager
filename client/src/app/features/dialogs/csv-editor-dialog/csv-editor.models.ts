/** A CSV row in the editor: `id` is stable while rows are added and removed. */
export interface CsvRow {
  id: number;
  cells: string[];
}

/** A row that passed the filter together with its position in the whole file. */
export interface VisibleCsvRow {
  row: CsvRow;
  index: number;
}
