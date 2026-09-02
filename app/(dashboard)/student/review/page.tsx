import Link from 'next/link';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';

export default async function Page() {
  await requireRole('STUDENT');

  const lessons = await prisma.lesson.findMany({
    where: { currentPublishedVersionId: { not: null } },
    include: { currentPublishedVersion: true },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-5">Ôn tập</h2>
      <div className="space-y-3">
        {lessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/student/review/${lesson.id}`}
            className="block border rounded-xl p-4"
          >
            <b>{lesson.title}</b>
            <p className="text-sm text-muted-foreground">
              Published v{lesson.currentPublishedVersion?.versionNumber}
            </p>
          </Link>
        ))}
        {!lessons.length && <p className="text-muted-foreground">Chưa có lesson đã publish.</p>}
      </div>
    </div>
  );
}
