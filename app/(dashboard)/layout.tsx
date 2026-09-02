import { requireUser } from '@/lib/auth/queries';

import { MobileBottomNav, Sidebar } from './nav';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();

  return (
    <div className="min-h-dvh flex">
      <Sidebar role={profile.role} />
      <div className="flex-1 min-w-0">
        <header className="md:hidden border-b px-4 py-3 font-bold">Flashcard Learning</header>
        <main className="px-4 py-6 md:px-8 pb-20">{children}</main>
      </div>
      <MobileBottomNav role={profile.role} />
    </div>
  );
}
