# Spaced English

Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SEED_TEACHER_EMAIL`, `SEED_TEACHER_PASSWORD`.

```bash
npm install
npm run db:migrate
# run supabase/profile-trigger.sql in Supabase SQL Editor
npm run db:seed
npm run build
```

Deploy this repo to Vercel with the same env vars.
