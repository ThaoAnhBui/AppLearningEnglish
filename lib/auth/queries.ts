import type { Profile, Role } from '@prisma/client';
import { redirect } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { createClient } from '@/lib/supabase/server';

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return prisma.profile.findUnique({ where: { id: user.id } });
}

export async function requireUser(): Promise<Profile> {
  const profile = await getProfile();

  if (!profile) {
    redirect('/sign-in');
  }

  return profile;
}

export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireUser();

  if (!roles.includes(profile.role)) {
    redirect('/dashboard');
  }

  return profile;
}
