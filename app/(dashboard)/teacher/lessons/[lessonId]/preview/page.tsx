import { notFound } from 'next/navigation';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const teacher = await requireRole('TEACHER', 'ADMIN');
  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      ...(teacher.role === 'ADMIN' ? {} : { teacherId: teacher.id }),
    },
  });

  if (!lesson) {
    notFound();
  }

  const draft = await prisma.lessonVersion.findFirst({
    where: { lessonId, status: 'DRAFT' },
    orderBy: { versionNumber: 'desc' },
    include: { cardVersions: true },
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Preview: {lesson.title}</h2>
      <p className="mb-4 text-muted-foreground">
        {draft ? `Draft v${draft.versionNumber}` : 'Không có draft'}
      </p>
      <div className="space-y-2">
        {draft?.cardVersions.map((cardVersion) => (
          <div key={cardVersion.id} className="border rounded-lg p-4">
            <b>{cardVersion.frontText}</b>
            <p>{cardVersion.backText}</p>
            {cardVersion.exampleSentence && (
              <i className="text-sm">{cardVersion.exampleSentence}</i>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
