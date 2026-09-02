'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import { importExcel, type ImportState } from './actions';

const initialState: ImportState = { message: '' };

type LessonOption = { id: string; title: string };

export function ImportForm({ lessons }: { lessons: LessonOption[] }) {
  const [state, action, pending] = useActionState(importExcel, initialState);
  const [lessonId, setLessonId] = useState('');
  const creatingNewLesson = !lessonId;

  return (
    <div className="space-y-4">
      <form action={action} className="border rounded-xl p-5 space-y-3">
        <label className="block text-sm">
          Đích import
          <select
            name="lessonId"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
            className="mt-1 w-full border rounded px-3 py-2 bg-background"
          >
            <option value="">Tạo lesson mới</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          Tên lesson mới
          <input
            name="title"
            disabled={!creatingNewLesson}
            required={creatingNewLesson}
            placeholder="Ví dụ: Unit 1 - Daily routines"
            className="mt-1 w-full border rounded px-3 py-2 disabled:opacity-50"
          />
        </label>

        <label className="block text-sm">
          File Excel
          <input
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="mt-1 block w-full"
          />
        </label>

        <button
          disabled={pending}
          className="bg-primary text-primary-foreground rounded px-4 py-2 disabled:opacity-60"
        >
          {pending ? 'Đang import...' : 'Import vào Draft'}
        </button>
      </form>

      {state.message && (
        <div className="border rounded-xl p-4">
          <b>{state.message}</b>
          {state.successRows !== undefined && (
            <p className="mt-1">
              {state.successRows} dòng OK, {state.errorRows} dòng lỗi.
            </p>
          )}
          {state.reusedRows !== undefined && (
            <p className="text-sm text-muted-foreground">
              Giữ identity: {state.reusedRows} thẻ · Thẻ mới: {state.newRows}
            </p>
          )}
          {state.lessonId && (
            <Link className="underline inline-block mt-2" href={`/teacher/lessons/${state.lessonId}`}>
              Xem draft
            </Link>
          )}
          {state.errors?.length ? (
            <ul className="mt-3 text-sm list-disc pl-5">
              {state.errors.map((error, index) => (
                <li key={`${error.row}-${index}`}>
                  Dòng {error.row}: {error.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
