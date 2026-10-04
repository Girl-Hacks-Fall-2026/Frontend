# Whimsy frontend

The app uses Supabase Auth for email/password sign-in, account creation, session persistence, and account settings. Usernames are unique lowercase handles and phone numbers are private profile fields in `public.profiles`.

## Local setup

1. Install dependencies with `npm install`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in a local `.env` file. Never put a service-role key in a `VITE_` variable.
3. Initialize and link the Supabase CLI if needed: `npx supabase init`, `npx supabase login`, then `npx supabase link --project-ref <project-ref>`.
4. Apply the Supabase migrations from the backend repo.
5. Deploy the delete-account Edge Function from the backend repo.
6. Run `npm run dev`.

The Supabase Edge Function uses the project's server-side `SUPABASE_SERVICE_ROLE_KEY` secret to delete only the user identified by the verified bearer session. Do not expose this secret to the frontend.

For password recovery, add the frontend's local and deployed URLs to the Supabase Auth redirect URL allow list. The reset email redirects back to the current frontend origin.

## Checks

- `npm run lint`
- `npm run build`
