import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requireRole } from '@/lib/auth/queries';
import { prisma } from '@/lib/db/prisma';

import { addCard, createDraft, deleteCard, publishVersion, updateCard } from '../actions';

export default async function Page({ params }: { params: Promise<{ lessonId: string }> }) {
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
    include: { cardVersions: { orderBy: { createdAt: 'asc' } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{lesson.title}</h2>
        <div className="flex flex-wrap gap-4 text-sm mt-2">
          {draft && (
            <Link className="underline" href={`/teacher/lessons/${lessonId}/preview`}>
              Preview
            </Link>
          )}
          <Link className="underline" href={`/teacher/lessons/${lessonId}/history`}>
            Revision History
          </Link>
          <Link className="underline" href="/teacher/import">
            Import Excel
          </Link>
        </div>
      </div>

      {draft ? (
        <>
          <div className="border rounded-xl p-4">
            <h3 className="font-semibold mb-3">Draft v{draft.versionNumber}</h3>
            <form action={addCard.bind(null, lessonId)} className="grid md:grid-cols-3 gap-2">
              <input
                name="frontText"
                required
                placeholder="front_text"
                className="border rounded px-3 py-2"
              />
              <input
                name="backText"
                required
                placeholder="back_text"
                className="border rounded px-3 py-2"
              />
              <input
                name="exampleSentence"
                placeholder="example_sentence"
                className="border rounded px-3 py-2"
              />
              <button className="md:col-span-3 border rounded py-2">Thêm thẻ</button>
            </form>
          </div>

          <div className="space-y-2">
            {draft.cardVersions.map((cardVersion) => (
              <div key={cardVersion.id} className="border rounded-lg p-3">
                <form
                  action={updateCard.bind(null, lessonId, cardVersion.flashcardId)}
                  className="grid md:grid-cols-3 gap-2"
                >
                  <input
                    name="frontText"
                    defaultValue={cardVersion.frontText}
                    required
                    className="border rounded px-2 py-1"
                  />
                  <input
                    name="backText"
                    defaultValue={cardVersion.backText}
                    required
                    className="border rounded px-2 py-1"
                  />
                  <input
                    name="exampleSentence"
                    defaultValue={cardVersion.exampleSentence ?? ''}
                    className="border rounded px-2 py-1"
                  />
                  <button className="text-sm border rounded py-1">Lưu sửa</button>
                </form>
                <form
                  action={deleteCard.bind(null, lessonId, cardVersion.flashcardId)}
                  className="mt-2"
                >
                  <button className="text-sm text-destructive">Xóa khỏi draft</button>
                </form>
              </div>
            ))}
          </div>

          <form
            action={publishVersion.bind(null, lessonId, draft.id)}
            className="border rounded-xl p-4 space-y-3"
          >
            <input
              name="note"
              placeholder="Ghi chú thay đổi khi publish"
              className="w-full border rounded px-3 py-2"
            />
            <button className="bg-primary text-primary-foreground rounded px-4 py-2">
              Publish draft
            </button>
          </form>
        </>
      ) : (
        <div className="border rounded-xl p-5 space-y-3">
          <p>Hiện không có draft đang chỉnh sửa.</p>
          <form action={createDraft.bind(null, lessonId)}>
            <button className="bg-primary text-primary-foreground rounded px-4 py-2">
              Tạo draft mới để chỉnh sửa
            </button>
          </form>
          <p className="text-sm text-muted-foreground">
            Draft mới sẽ giữ nguyên identity của các thẻ trong version gần nhất để không làm mất
            tiến độ FSRS của sinh viên.
          </p>
        </div>
      )}
    </div>
  );
}
