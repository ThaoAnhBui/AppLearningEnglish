import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';
import { ensureProgressRecords } from '@/lib/srs/progress';

import { ReviewCard } from './review-card';

export default async function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const student = await requireRole('STUDENT');
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      currentPublishedVersion: {
        include: { cardVersions: true },
      },
    },
  });

  if (!lesson?.currentPublishedVersion) {
    return <p>Lesson chưa được publish.</p>;
  }

  const flashcardIds = lesson.currentPublishedVersion.cardVersions.map(
    (cardVersion) => cardVersion.flashcardId,
  );

  await ensureProgressRecords(student.id, flashcardIds);

  const dueProgress = await prisma.studentProgress.findMany({
    where: {
      studentId: student.id,
      flashcardId: { in: flashcardIds },
      due: { lte: new Date() },
    },
    orderBy: { due: 'asc' },
  });

  if (!dueProgress.length) {
    return (
      <div>
        <h2 className="text-2xl font-bold">{lesson.title}</h2>
        <p className="mt-3">Không còn thẻ đến hạn.</p>
      </div>
    );
  }

  const progress = dueProgress[0];
  const content = lesson.currentPublishedVersion.cardVersions.find(
    (cardVersion) => cardVersion.flashcardId === progress.flashcardId,
  );

  if (!content) {
    return <p>Không tìm thấy nội dung thẻ trong phiên bản đang publish.</p>;
  }

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4">{lesson.title}</h2>
      <ReviewCard
        lessonId={lessonId}
        progressId={progress.id}
        frontText={content.frontText}
        backText={content.backText}
        exampleSentence={content.exampleSentence}
      />
    </div>
  );
}
