import { redirect } from 'next/navigation';

import { getProfile } from '@/lib/auth/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const profile = await getProfile();
  redirect(profile ? '/dashboard' : '/sign-in');
}
