import Link from 'next/link';

import { requireUser } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';

export default async function Dashboard() {
  const profile = await requireUser();

  if (profile.role === 'STUDENT') {
    const [lessons, due] = await Promise.all([
      prisma.lesson.count({ where: { currentPublishedVersionId: { not: null } } }),
      prisma.studentProgress.count({
        where: { studentId: profile.id, due: { lte: new Date() } },
      }),
    ]);

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Dashboard sinh viên</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Card title="Bài học đã xuất bản" value={lessons} />
          <Card title="Thẻ đến hạn" value={due} />
        </div>
        <Link className="inline-block underline" href="/student/review">
          Bắt đầu ôn tập →
        </Link>
      </div>
    );
  }

  const teacherFilter = profile.role === 'ADMIN' ? {} : { teacherId: profile.id };
  const authorFilter = profile.role === 'ADMIN' ? {} : { createdById: profile.id };

  const [lessons, drafts, imports] = await Promise.all([
    prisma.lesson.count({ where: teacherFilter }),
    prisma.lessonVersion.count({ where: { ...authorFilter, status: 'DRAFT' } }),
    prisma.importBatch.count({ where: authorFilter }),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        Dashboard {profile.role === 'ADMIN' ? 'quản trị' : 'giáo viên'}
      </h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card title="Lessons" value={lessons} />
        <Card title="Drafts" value={drafts} />
        <Card title="Import batches" value={imports} />
      </div>
      <div className="flex gap-4">
        <Link className="underline" href="/teacher/lessons">
          Quản lý bài học
        </Link>
        <Link className="underline" href="/teacher/import">
          Import Excel
        </Link>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="border rounded-xl p-5 bg-card">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
