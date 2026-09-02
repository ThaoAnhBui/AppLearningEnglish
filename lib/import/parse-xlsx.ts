import { readSheet, type CellValue } from 'read-excel-file/node';
import { z } from 'zod';

import { validateXlsxArchive } from './validate-xlsx-archive';

const REQUIRED_HEADERS = ['front_text', 'back_text'] as const;
const SUPPORTED_HEADERS = new Set(['front_text', 'back_text', 'example_sentence']);
const MAX_DATA_ROWS = 5_000;
const MAX_HEADER_COLUMNS = 50;

const rowSchema = z.object({
  front_text: z.string().trim().min(1, 'front_text không được để trống'),
  back_text: z.string().trim().min(1, 'back_text không được để trống'),
  example_sentence: z.string().trim().optional(),
});

export type ParsedRow = z.infer<typeof rowSchema>;
export type RowError = { row: number; message: string };
export type ParseLessonResult = {
  valid: ParsedRow[];
  errors: RowError[];
  totalRows: number;
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeIdentityText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function cellToText(value: CellValue | undefined) {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function flashcardIdentityKey(frontText: string, backText: string) {
  return `${normalizeIdentityText(frontText)}\u0000${normalizeIdentityText(backText)}`;
}

export function flashcardFrontKey(frontText: string) {
  return normalizeIdentityText(frontText);
}

export async function parseLessonWorkbook(buffer: ArrayBuffer): Promise<ParseLessonResult> {
  validateXlsxArchive(buffer);

  const rows = await readSheet(Buffer.from(buffer));
  if (!rows.length) {
    return {
      valid: [],
      errors: [{ row: 1, message: 'Workbook không có dữ liệu.' }],
      totalRows: 0,
    };
  }

  const headerRow = rows[0];
  const headerToColumn = new Map<string, number>();
  const headerColumnCount = Math.min(headerRow.length, MAX_HEADER_COLUMNS);

  for (let column = 0; column < headerColumnCount; column += 1) {
    const header = normalizeHeader(cellToText(headerRow[column]));
    if (header && SUPPORTED_HEADERS.has(header) && !headerToColumn.has(header)) {
      headerToColumn.set(header, column);
    }
  }

  const totalRows = Math.max(rows.length - 1, 0);
  if (totalRows > MAX_DATA_ROWS) {
    return {
      valid: [],
      errors: [
        {
          row: 1,
          message: `File có ${totalRows} dòng dữ liệu, vượt giới hạn ${MAX_DATA_ROWS} dòng mỗi lần import.`,
        },
      ],
      totalRows,
    };
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerToColumn.has(header));
  if (missingHeaders.length) {
    return {
      valid: [],
      errors: [
        {
          row: 1,
          message: `Thiếu cột bắt buộc: ${missingHeaders.join(', ')}. Header không phân biệt hoa/thường và được tự trim.`,
        },
      ],
      totalRows,
    };
  }

  const valid: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const raw = {
      front_text: cellToText(row[headerToColumn.get('front_text')!]),
      back_text: cellToText(row[headerToColumn.get('back_text')!]),
      example_sentence: headerToColumn.has('example_sentence')
        ? cellToText(row[headerToColumn.get('example_sentence')!])
        : '',
    };

    if (!raw.front_text.trim() && !raw.back_text.trim() && !raw.example_sentence.trim()) {
      errors.push({ row: rowNumber, message: 'Dòng trống.' });
      return;
    }

    const result = rowSchema.safeParse(raw);
    if (!result.success) {
      errors.push({
        row: rowNumber,
        message: result.error.issues.map((issue) => issue.message).join('; '),
      });
      return;
    }

    const duplicateKey = flashcardIdentityKey(result.data.front_text, result.data.back_text);
    if (seen.has(duplicateKey)) {
      errors.push({ row: rowNumber, message: 'Dòng trùng front_text/back_text.' });
      return;
    }

    seen.add(duplicateKey);
    valid.push(result.data);
  });

  return { valid, errors, totalRows };
}
