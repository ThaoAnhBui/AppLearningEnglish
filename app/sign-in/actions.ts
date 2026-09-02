'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type SignInState = { error: string };

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Email hoặc mật khẩu không đúng.' };
  }

  redirect('/dashboard');
}
