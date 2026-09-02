'use server';

import { revalidatePath } from 'next/cache';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';
import { schedule, toFsrsCard } from '@/lib/srs/fsrs';

export async function submitReview(
  lessonId: string,
  progressId: string,
  rating: 1 | 2 | 3 | 4,
) {
  const student = await requireRole('STUDENT');
  if (![1, 2, 3, 4].includes(rating)) {
    throw new Error('Rating không hợp lệ.');
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { currentPublishedVersionId: true },
  });

  if (!lesson?.currentPublishedVersionId) {
    throw new Error('Lesson chưa có version đang publish.');
  }

  const progress = await prisma.studentProgress.findFirst({
    where: {
      id: progressId,
      studentId: student.id,
      flashcard: {
        lessonId,
        versions: {
          some: { lessonVersionId: lesson.currentPublishedVersionId },
        },
      },
    },
  });

  if (!progress) {
    throw new Error('Không tìm thấy tiến độ thuộc version đang publish của lesson.');
  }

  const result = schedule(toFsrsCard(progress), rating);

  await prisma.$transaction([
    prisma.studentProgress.update({
      where: { id: progress.id },
      data: {
        due: result.card.due,
        stability: result.card.stability,
        difficulty: result.card.difficulty,
        elapsedDays: result.card.elapsed_days,
        scheduledDays: result.card.scheduled_days,
        reps: result.card.reps,
        lapses: result.card.lapses,
        learningSteps: result.card.learning_steps,
        state: result.stateAfter,
        lastReview: result.card.last_review ?? null,
      },
    }),
    prisma.reviewLog.create({
      data: {
        studentProgressId: progress.id,
        rating,
        stateBefore: progress.state,
        due: result.card.due,
        stability: result.card.stability,
        difficulty: result.card.difficulty,
        elapsedDays: result.card.elapsed_days,
        scheduledDays: result.card.scheduled_days,
        learningSteps: result.card.learning_steps,
      },
    }),
  ]);

  revalidatePath(`/student/review/${lessonId}`);
}
