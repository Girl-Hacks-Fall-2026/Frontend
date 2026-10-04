# Whimsy frontend

The app uses Supabase Auth for email/password sign-in, account creation, session persistence, and account settings. Usernames are read from and written to the authenticated user's row in `public."User_Profile"`; the frontend does not assume any additional profile tables or columns.

## Local setup

1. Install dependencies with `npm install`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a local `.env` file. Never put a service-role key in a `VITE_` variable.
3. Initialize and link the Supabase CLI if needed: `npx supabase init`, `npx supabase login`, then `npx supabase link --project-ref <project-ref>`.
4. Ensure `public."User_Profile"` is exposed through the Supabase Data API and authenticated users have appropriate row-level security policies for their own row. The frontend expects its existing `user_id` and `username` columns.
5. Deploy the delete-account Edge Function from the backend repo.
6. Run `npm run dev`.

The Supabase Edge Function uses the project's server-side `SUPABASE_SERVICE_ROLE_KEY` secret to delete only the user identified by the verified bearer session. Do not expose this secret to the frontend.

Email confirmation and password recovery redirect to the current frontend origin. Add the local and deployed frontend URLs to the Supabase Auth redirect URL allow list.

## Checks

- `npm run lint`
- `npm run build`
