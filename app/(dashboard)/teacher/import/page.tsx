import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';

import { ImportForm } from './import-form';

export default async function Page() {
  const teacher = await requireRole('TEACHER', 'ADMIN');
  const lessons = await prisma.lesson.findMany({
    where: teacher.role === 'ADMIN' ? {} : { teacherId: teacher.id },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true },
  });

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-2">Import Excel</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Cột bắt buộc: front_text, back_text. Tùy chọn: example_sentence. File tối đa 5 MB.
      </p>
      <ImportForm lessons={lessons} />
    </div>
  );
}
