'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';
import { matchImportedRows } from '@/lib/import/match-flashcards';
import { parseLessonWorkbook } from '@/lib/import/parse-xlsx';
import { InvalidXlsxArchiveError } from '@/lib/import/validate-xlsx-archive';
import { nextVersionNumber } from '@/lib/versioning/lesson-version';

const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const XLSX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
  'application/zip',
]);

export type ImportState = {
  message: string;
  lessonId?: string;
  successRows?: number;
  errorRows?: number;
  reusedRows?: number;
  newRows?: number;
  errors?: { row: number; message: string }[];
};

export async function importExcel(_: ImportState, formData: FormData): Promise<ImportState> {
  const teacher = await requireRole('TEACHER', 'ADMIN');
  const file = formData.get('file');

  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx')) {
    return { message: 'Vui lòng chọn file .xlsx.' };
  }

  if (file.size === 0) {
    return { message: 'File Excel đang trống.' };
  }

  if (file.size > MAX_XLSX_BYTES) {
    return { message: 'File Excel vượt quá giới hạn 5 MB.' };
  }

  if (file.type && !XLSX_MIME_TYPES.has(file.type)) {
    return { message: `Định dạng MIME không hợp lệ: ${file.type}.` };
  }

  const buffer = await file.arrayBuffer();

  let parsed;
  try {
    parsed = await parseLessonWorkbook(buffer);
  } catch (error) {
    return {
      message:
        error instanceof InvalidXlsxArchiveError
          ? error.message
          : 'Không thể đọc file Excel. Hãy kiểm tra file có bị hỏng hoặc chỉ bị đổi đuôi thành .xlsx.',
    };
  }

  if (!parsed.valid.length) {
    return {
      message: 'Không có dòng hợp lệ để import.',
      successRows: 0,
      errorRows: parsed.errors.length,
      errors: parsed.errors,
    };
  }

  const requestedLessonId = String(formData.get('lessonId') ?? '').trim();
  const title = String(formData.get('title') ?? file.name.replace(/\.xlsx$/i, '')).trim();

  let existingLesson = null;
  let baselineVersion = null;

  if (requestedLessonId) {
    existingLesson = await prisma.lesson.findFirst({
      where: {
        id: requestedLessonId,
        ...(teacher.role === 'ADMIN' ? {} : { teacherId: teacher.id }),
      },
      include: {
        currentPublishedVersion: {
          include: { cardVersions: true },
        },
      },
    });

    if (!existingLesson) {
      return { message: 'Lesson không tồn tại hoặc bạn không có quyền truy cập.' };
    }

    baselineVersion = await prisma.lessonVersion.findFirst({
      where: { lessonId: requestedLessonId },
      orderBy: { versionNumber: 'desc' },
      include: { cardVersions: true },
    });
  } else if (!title) {
    return { message: 'Tên lesson không được để trống khi tạo lesson mới.' };
  }

  const baselineByFlashcardId = new Map<
    string,
    { flashcardId: string; frontText: string; backText: string }
  >();

  for (const card of existingLesson?.currentPublishedVersion?.cardVersions ?? []) {
    baselineByFlashcardId.set(card.flashcardId, {
      flashcardId: card.flashcardId,
      frontText: card.frontText,
      backText: card.backText,
    });
  }

  for (const card of baselineVersion?.cardVersions ?? []) {
    baselineByFlashcardId.set(card.flashcardId, {
      flashcardId: card.flashcardId,
      frontText: card.frontText,
      backText: card.backText,
    });
  }

  const baselineCards = [...baselineByFlashcardId.values()];
  const matchedRows = matchImportedRows(parsed.valid, baselineCards);
  const reusedRows = matchedRows.filter((item) => item.flashcardId).length;
  const newRows = matchedRows.length - reusedRows;

  const result = await prisma.$transaction(async (tx) => {
    const lesson = existingLesson
      ? existingLesson
      : await tx.lesson.create({
          data: { title, teacherId: teacher.id },
        });

    const latestVersion = existingLesson
      ? await tx.lessonVersion.findFirst({
          where: { lessonId: lesson.id },
          orderBy: { versionNumber: 'desc' },
        })
      : null;

    await tx.lessonVersion.updateMany({
      where: { lessonId: lesson.id, status: 'DRAFT' },
      data: { status: 'ARCHIVED' },
    });

    const version = await tx.lessonVersion.create({
      data: {
        lessonId: lesson.id,
        versionNumber: nextVersionNumber(latestVersion),
        status: 'DRAFT',
        source: 'IMPORT',
        createdById: teacher.id,
      },
    });

    for (const { row, flashcardId: matchedFlashcardId } of matchedRows) {
      if (matchedFlashcardId) {
        await tx.flashcardVersion.create({
          data: {
            flashcardId: matchedFlashcardId,
            lessonVersionId: version.id,
            frontText: row.front_text,
            backText: row.back_text,
            exampleSentence: row.example_sentence || null,
            source: 'IMPORT',
          },
        });
      } else {
        await tx.flashcard.create({
          data: {
            lessonId: lesson.id,
            versions: {
              create: {
                lessonVersionId: version.id,
                frontText: row.front_text,
                backText: row.back_text,
                exampleSentence: row.example_sentence || null,
                source: 'IMPORT',
              },
            },
          },
        });
      }
    }

    await tx.importBatch.create({
      data: {
        lessonVersionId: version.id,
        fileName: file.name,
        totalRows: parsed.totalRows,
        successRows: parsed.valid.length,
        errorRows: parsed.errors.length,
        errorsJson: parsed.errors,
        createdById: teacher.id,
      },
    });

    return { lessonId: lesson.id };
  });

  revalidatePath(`/teacher/lessons/${result.lessonId}`);
  revalidatePath('/teacher/import');

  return {
    message: 'Import hoàn tất vào draft mới.',
    lessonId: result.lessonId,
    successRows: parsed.valid.length,
    errorRows: parsed.errors.length,
    reusedRows,
    newRows,
    errors: parsed.errors,
  };
}
