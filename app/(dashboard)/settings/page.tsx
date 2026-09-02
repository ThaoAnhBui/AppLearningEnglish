import { requireUser } from '@/lib/auth/queries';

export default async function Settings() {
  const profile = await requireUser();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      <div className="border rounded-xl p-5 max-w-lg">
        <p>
          <b>Email:</b> {profile.email}
        </p>
        <p>
          <b>Role:</b> {profile.role}
        </p>
      </div>
    </div>
  );
}
