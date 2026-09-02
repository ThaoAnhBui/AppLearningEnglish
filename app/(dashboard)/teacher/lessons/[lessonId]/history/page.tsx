import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';
import { canRollbackVersion } from '@/lib/versioning/lesson-version';

import { rollbackVersion } from '../../actions';

export default async function HistoryPage({
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

  const versions = await prisma.lessonVersion.findMany({
    where: { lessonId },
    orderBy: { versionNumber: 'desc' },
    include: { _count: { select: { cardVersions: true } } },
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-5">Revision History</h2>
      <div className="space-y-3">
        {versions.map((version) => (
          <div
            key={version.id}
            className="border rounded-xl p-4 flex justify-between gap-3"
          >
            <div>
              <b>
                v{version.versionNumber} · {version.status}
              </b>
              <p className="text-sm text-muted-foreground">
                {version._count.cardVersions} thẻ · {version.note || 'Không có ghi chú'}
              </p>
              <Link
                className="text-sm underline"
                href={`/teacher/lessons/${lessonId}/history/${version.id}/diff`}
              >
                Xem diff
              </Link>
            </div>
            {canRollbackVersion(version) ? (
              <form action={rollbackVersion.bind(null, lessonId, version.id)}>
                <button className="border rounded px-3 py-1.5 text-sm">Rollback</button>
              </form>
            ) : (
              <span className="text-xs text-muted-foreground self-center">
                {version.status === 'DRAFT'
                  ? 'Draft chưa publish'
                  : version.status === 'ARCHIVED' && !version.publishedAt
                    ? 'Draft cũ đã lưu lịch sử'
                    : 'Version hiện tại'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
