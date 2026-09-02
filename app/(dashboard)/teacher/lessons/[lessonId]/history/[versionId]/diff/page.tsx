import { notFound } from 'next/navigation';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';

export default async function DiffPage({
  params,
}: {
  params: Promise<{ lessonId: string; versionId: string }>;
}) {
  const teacher = await requireRole('TEACHER', 'ADMIN');
  const { lessonId, versionId } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      ...(teacher.role === 'ADMIN' ? {} : { teacherId: teacher.id }),
    },
    select: { id: true },
  });

  if (!lesson) {
    notFound();
  }

  const currentVersion = await prisma.lessonVersion.findFirst({
    where: { id: versionId, lessonId },
    include: { cardVersions: true },
  });

  if (!currentVersion) {
    notFound();
  }

  const previousVersion = await prisma.lessonVersion.findFirst({
    where: {
      lessonId,
      versionNumber: { lt: currentVersion.versionNumber },
    },
    orderBy: { versionNumber: 'desc' },
    include: { cardVersions: true },
  });

  const previousCards = new Map(
    previousVersion?.cardVersions.map((cardVersion) => [cardVersion.flashcardId, cardVersion]) ?? [],
  );
  const currentCards = new Map(
    currentVersion.cardVersions.map((cardVersion) => [cardVersion.flashcardId, cardVersion]),
  );
  const flashcardIds = new Set([...previousCards.keys(), ...currentCards.keys()]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">
        Diff v{previousVersion?.versionNumber ?? '∅'} → v{currentVersion.versionNumber}
      </h2>
      <div className="space-y-2">
        {[...flashcardIds].map((flashcardId) => {
          const previous = previousCards.get(flashcardId);
          const current = currentCards.get(flashcardId);
          const status = !previous
            ? 'MỚI'
            : !current
              ? 'XÓA'
              : previous.frontText !== current.frontText ||
                  previous.backText !== current.backText ||
                  previous.exampleSentence !== current.exampleSentence
                ? 'SỬA'
                : 'GIỮ';

          return (
            <div className="border rounded p-3" key={flashcardId}>
              <b>{status}</b>
              <p>
                {previous?.frontText ?? '∅'} → {current?.frontText ?? '∅'}
              </p>
              <p className="text-sm text-muted-foreground">
                {previous?.backText ?? '∅'} → {current?.backText ?? '∅'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
