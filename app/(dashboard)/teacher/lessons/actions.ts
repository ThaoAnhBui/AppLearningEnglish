'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';
import { copySnapshotCard, nextVersionNumber } from '@/lib/versioning/lesson-version';

async function requireTeacher() {
  return requireRole('TEACHER', 'ADMIN');
}

async function requireOwnedLesson(lessonId: string, userId: string) {
  const actor = await prisma.profile.findUnique({ where: { id: userId } });
  const lesson = await prisma.lesson.findFirst({
    where: actor?.role === 'ADMIN' ? { id: lessonId } : { id: lessonId, teacherId: userId },
  });

  if (!lesson) {
    throw new Error('Không tìm thấy lesson hoặc không có quyền.');
  }

  return lesson;
}

export async function createLesson(formData: FormData) {
  const teacher = await requireTeacher();
  const title = String(formData.get('title') ?? '').trim();

  if (!title) {
    throw new Error('Tên bài học là bắt buộc.');
  }

  const lesson = await prisma.lesson.create({
    data: {
      title,
      description: String(formData.get('description') ?? '').trim() || null,
      teacherId: teacher.id,
      versions: {
        create: {
          versionNumber: 1,
          status: 'DRAFT',
          source: 'MANUAL',
          createdById: teacher.id,
        },
      },
    },
  });

  redirect(`/teacher/lessons/${lesson.id}`);
}

async function getDraft(lessonId: string, userId: string) {
  await requireOwnedLesson(lessonId, userId);

  const existingDraft = await prisma.lessonVersion.findFirst({
    where: { lessonId, status: 'DRAFT' },
    orderBy: { versionNumber: 'desc' },
  });

  if (existingDraft) {
    return existingDraft;
  }

  const lastVersion = await prisma.lessonVersion.findFirst({
    where: { lessonId },
    orderBy: { versionNumber: 'desc' },
    include: { cardVersions: true },
  });
  const versionNumber = nextVersionNumber(lastVersion);

  return prisma.$transaction(async (tx) => {
    const draft = await tx.lessonVersion.create({
      data: {
        lessonId,
        versionNumber,
        status: 'DRAFT',
        source: 'MANUAL',
        createdById: userId,
      },
    });

    if (lastVersion) {
      for (const cardVersion of lastVersion.cardVersions) {
        await tx.flashcardVersion.create({
          data: copySnapshotCard(cardVersion, draft.id),
        });
      }
    }

    return draft;
  });
}

export async function createDraft(lessonId: string) {
  const teacher = await requireTeacher();
  await getDraft(lessonId, teacher.id);
  revalidatePath(`/teacher/lessons/${lessonId}`);
}

export async function addCard(lessonId: string, formData: FormData) {
  const teacher = await requireTeacher();
  const draft = await getDraft(lessonId, teacher.id);
  const frontText = String(formData.get('frontText') ?? '').trim();
  const backText = String(formData.get('backText') ?? '').trim();

  if (!frontText || !backText) {
    throw new Error('Mặt trước và mặt sau là bắt buộc.');
  }

  await prisma.flashcard.create({
    data: {
      lessonId,
      versions: {
        create: {
          lessonVersionId: draft.id,
          frontText,
          backText,
          exampleSentence: String(formData.get('exampleSentence') ?? '').trim() || null,
          source: 'MANUAL',
        },
      },
    },
  });

  revalidatePath(`/teacher/lessons/${lessonId}`);
}

export async function updateCard(
  lessonId: string,
  flashcardId: string,
  formData: FormData,
) {
  const teacher = await requireTeacher();
  const draft = await getDraft(lessonId, teacher.id);
  const frontText = String(formData.get('frontText') ?? '').trim();
  const backText = String(formData.get('backText') ?? '').trim();

  if (!frontText || !backText) {
    throw new Error('Mặt trước và mặt sau là bắt buộc.');
  }

  await prisma.flashcardVersion.update({
    where: {
      flashcardId_lessonVersionId: {
        flashcardId,
        lessonVersionId: draft.id,
      },
    },
    data: {
      frontText,
      backText,
      exampleSentence: String(formData.get('exampleSentence') ?? '').trim() || null,
    },
  });

  revalidatePath(`/teacher/lessons/${lessonId}`);
}

export async function deleteCard(lessonId: string, flashcardId: string) {
  const teacher = await requireTeacher();
  const draft = await getDraft(lessonId, teacher.id);

  await prisma.flashcardVersion.deleteMany({
    where: { lessonVersionId: draft.id, flashcardId },
  });

  revalidatePath(`/teacher/lessons/${lessonId}`);
}

export async function publishVersion(
  lessonId: string,
  versionId: string,
  formData: FormData,
) {
  const teacher = await requireTeacher();
  await requireOwnedLesson(lessonId, teacher.id);

  const version = await prisma.lessonVersion.findFirst({
    where: { id: versionId, lessonId, status: 'DRAFT' },
  });

  if (!version) {
    throw new Error('Draft không hợp lệ.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.lessonVersion.updateMany({
      where: { lessonId, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });
    await tx.lessonVersion.update({
      where: { id: version.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        note: String(formData.get('note') ?? '').trim() || null,
      },
    });
    await tx.lesson.update({
      where: { id: lessonId },
      data: { currentPublishedVersionId: version.id },
    });
  });

  revalidatePath(`/teacher/lessons/${lessonId}`);
  redirect(`/teacher/lessons/${lessonId}/history`);
}

export async function rollbackVersion(lessonId: string, targetVersionId: string) {
  const teacher = await requireTeacher();
  await requireOwnedLesson(lessonId, teacher.id);

  const targetVersion = await prisma.lessonVersion.findFirst({
    where: {
      id: targetVersionId,
      lessonId,
      status: 'ARCHIVED',
      publishedAt: { not: null },
    },
    include: { cardVersions: true },
  });

  if (!targetVersion) {
    throw new Error('Chỉ có thể rollback về một version đã từng được publish và hiện đang ARCHIVED.');
  }

  const latestVersion = await prisma.lessonVersion.findFirst({
    where: { lessonId },
    orderBy: { versionNumber: 'desc' },
  });

  await prisma.$transaction(async (tx) => {
    await tx.lessonVersion.updateMany({
      where: { lessonId, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });

    const rollbackVersion = await tx.lessonVersion.create({
      data: {
        lessonId,
        versionNumber: nextVersionNumber(latestVersion),
        status: 'PUBLISHED',
        source: targetVersion.source,
        note: `Rollback từ v${targetVersion.versionNumber}`,
        createdById: teacher.id,
        publishedAt: new Date(),
      },
    });

    for (const cardVersion of targetVersion.cardVersions) {
      await tx.flashcardVersion.create({
        data: copySnapshotCard(cardVersion, rollbackVersion.id),
      });
    }

    await tx.lesson.update({
      where: { id: lessonId },
      data: { currentPublishedVersionId: rollbackVersion.id },
    });
  });

  revalidatePath(`/teacher/lessons/${lessonId}/history`);
}
