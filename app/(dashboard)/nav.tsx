'use client';

import type { Role } from '@prisma/client';
import { BookOpen, GraduationCap, LayoutDashboard, Settings, Upload } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SignOutButton } from './sign-out-button';

const teacherItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/lessons', label: 'Lessons', icon: BookOpen },
  { href: '/teacher/import', label: 'Import Excel', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const studentItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/student/review', label: 'Review', icon: GraduationCap },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function itemsForRole(role: Role) {
  return role === 'STUDENT' ? studentItems : teacherItems;
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = itemsForRole(role);

  return (
    <aside className="w-64 border-r bg-card hidden md:flex flex-col">
      <div className="p-6 border-b">
        <h1 className="font-bold">Flashcard Learning</h1>
        <p className="text-xs text-muted-foreground">Versioning + FSRS</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex gap-3 items-center rounded-lg px-3 py-2 text-sm ${
              pathname.startsWith(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t">
        <SignOutButton />
      </div>
    </aside>
  );
}

export function MobileBottomNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = itemsForRole(role);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-50 flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex-1 py-2 text-[11px] flex flex-col items-center ${
            pathname.startsWith(item.href) ? 'text-primary' : 'text-muted-foreground'
          }`}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
