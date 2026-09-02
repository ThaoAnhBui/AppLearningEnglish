import Link from 'next/link';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';

export default async function Page() {
  const teacher = await requireRole('TEACHER', 'ADMIN');
  const lessons = await prisma.lesson.findMany({
    where: teacher.role === 'ADMIN' ? {} : { teacherId: teacher.id },
    include: { currentPublishedVersion: true },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Lessons</h2>
        <Link
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2"
          href="/teacher/lessons/new"
        >
          Tạo lesson
        </Link>
      </div>

      <div className="space-y-3">
        {lessons.map((lesson) => (
          <Link
            key={lesson.id}
            href={`/teacher/lessons/${lesson.id}`}
            className="block border rounded-xl p-4 hover:bg-accent"
          >
            <b>{lesson.title}</b>
            <p className="text-sm text-muted-foreground">
              {lesson.currentPublishedVersion
                ? `Đang publish v${lesson.currentPublishedVersion.versionNumber}`
                : 'Chưa publish'}
            </p>
          </Link>
        ))}
        {!lessons.length && <p className="text-muted-foreground">Chưa có lesson.</p>}
      </div>
    </div>
  );
}
