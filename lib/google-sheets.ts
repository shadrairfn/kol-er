import 'server-only';
import { google } from 'googleapis';

function env(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Environment variable ${name} belum diatur`);
  }

  return value;
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env('GOOGLE_CLIENT_EMAIL'),
    private_key: env('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({
  version: 'v4',
  auth,
});

const spreadsheetId = env('GOOGLE_SHEET_ID');

export async function getUsers() {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Users!A:H',
  });

  const rows = result.data.values ?? [];
  const [headers, ...data] = rows;

  if (!headers) return [];

  return data.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? '']),
    ),
  );
}

export async function saveUser(user: {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  provider: string;
  created_at: string;
  last_login?: string;
  role?: string;
}) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Users!A:H',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [
        [
          user.id,
          user.name,
          user.email,
          user.password_hash ?? '',
          user.provider,
          user.created_at,
          user.last_login ?? '',
          user.role ?? 'user',
        ],
      ],
    },
  });
}

export async function appendRow(
  sheetName: string,
  values: Array<string | number>,
) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [values],
    },
  });
}

export async function getSheetRecords(sheetName: 'Users' | 'KOL') {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  const rows = result.data.values ?? [];
  const [headers, ...data] = rows;
  if (!headers) return [];

  return data.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [String(header).trim(), row[index] ?? '']),
    ),
  );
}

export async function appendSheetRecord(
  sheetName: 'KOL',
  record: Record<string, string | number>,
) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const headers = result.data.values?.[0]?.map((header) =>
    String(header).trim(),
  );

  if (!headers?.length) {
    throw new Error(`Header pada tab ${sheetName} belum tersedia.`);
  }

  const values = headers.map((header) => {
    const normalized = header.toLowerCase().replace(/[\s-]+/g, '_');
    return record[normalized] ?? '';
  });

  await appendRow(sheetName, values);
}

/* ---------- Generic tables: header row = field names, one record per row ---------- */

export type Cell = string | number | boolean | null | undefined;
export type TableSpec = { sheet: string; headers: readonly string[] };
export type TableRecord = {
  /** 1-based sheet row number, used for in-place updates. */
  row: number;
  values: Record<string, unknown>;
};

export function normalizeHeader(header: unknown) {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function quoteSheet(sheet: string) {
  return `'${sheet.replace(/'/g, "''")}'`;
}

function columnLetter(index: number) {
  let n = index;
  let letters = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Normalized header row per sheet, re-checked every few minutes in case the sheet is edited by hand. */
const headerCache = new Map<
  string,
  { at: number; headers: Promise<string[]> }
>();
const HEADER_TTL_MS = 5 * 60 * 1000;

async function prepareTable({ sheet, headers }: TableSpec) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(sheetId,title,gridProperties.columnCount)',
  });
  const found = meta.data.sheets?.find(
    (item) => item.properties?.title === sheet,
  );
  let sheetId = found?.properties?.sheetId ?? null;
  let columnCount = found?.properties?.gridProperties?.columnCount ?? 0;

  if (sheetId === null) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheet,
                gridProperties: {
                  rowCount: 1000,
                  columnCount: Math.max(26, headers.length),
                  frozenRowCount: 1,
                },
              },
            },
          },
        ],
      },
    });
    const props = created.data.replies?.[0]?.addSheet?.properties;
    sheetId = props?.sheetId ?? null;
    columnCount =
      props?.gridProperties?.columnCount ?? Math.max(26, headers.length);
  }

  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteSheet(sheet)}!1:1`,
  });
  const current = (result.data.values?.[0] ?? []).map((header) =>
    String(header).trim(),
  );
  const normalized = current.map(normalizeHeader);
  const missing = headers.filter((header) => !normalized.includes(header));
  if (!missing.length) return normalized;

  const next = [...current, ...missing];
  if (sheetId !== null && next.length > columnCount) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            appendDimension: {
              sheetId,
              dimension: 'COLUMNS',
              length: next.length - columnCount,
            },
          },
        ],
      },
    });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheet(sheet)}!A1:${columnLetter(next.length)}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [next] },
  });
  return next.map(normalizeHeader);
}

/** Creates the tab and/or appends missing header columns; returns the normalized header row. */
export function ensureTable(spec: TableSpec) {
  const cached = headerCache.get(spec.sheet);
  if (cached && Date.now() - cached.at < HEADER_TTL_MS) return cached.headers;
  const headers = prepareTable(spec).catch((error) => {
    headerCache.delete(spec.sheet);
    throw error;
  });
  headerCache.set(spec.sheet, { at: Date.now(), headers });
  return headers;
}

/** Reads several tables with a single API call. */
export async function readTables<K extends string>(
  specs: Record<K, TableSpec>,
): Promise<Record<K, TableRecord[]>> {
  const keys = Object.keys(specs) as K[];
  await Promise.all(keys.map((key) => ensureTable(specs[key])));
  const result = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: keys.map((key) => quoteSheet(specs[key].sheet)),
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const output = {} as Record<K, TableRecord[]>;
  keys.forEach((key, index) => {
    const rows = result.data.valueRanges?.[index]?.values ?? [];
    const [headerRow = [], ...data] = rows;
    const headers = headerRow.map(normalizeHeader);
    output[key] = data
      .map((row, rowIndex) => ({
        row: rowIndex + 2,
        values: Object.fromEntries(
          headers.map((header, column) => [header, row[column] ?? '']),
        ),
      }))
      .filter((record) =>
        Object.values(record.values).some(
          (value) => value !== '' && value !== null,
        ),
      );
  });
  return output;
}

function toCell(value: Cell) {
  return value === null || value === undefined ? '' : value;
}

export async function insertRecords(
  spec: TableSpec,
  records: Record<string, Cell>[],
) {
  if (!records.length) return;
  const headers = await ensureTable(spec);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${quoteSheet(spec.sheet)}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: records.map((record) =>
        headers.map((header) => toCell(record[header])),
      ),
    },
  });
}

/** Updates only the given fields of existing rows. */
export async function updateRecords(
  spec: TableSpec,
  updates: { row: number; values: Record<string, Cell> }[],
) {
  if (!updates.length) return;
  const headers = await ensureTable(spec);
  const data = updates.flatMap(({ row, values }) =>
    Object.entries(values)
      .map(([field, value]) => ({ column: headers.indexOf(field), value }))
      .filter(({ column }) => column >= 0)
      .map(({ column, value }) => ({
        range: `${quoteSheet(spec.sheet)}!${columnLetter(column + 1)}${row}`,
        values: [[toCell(value)]],
      })),
  );
  if (!data.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data },
  });
}
