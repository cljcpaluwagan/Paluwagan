# Paluwagan

React + Vite + Capacitor (Android) + Supabase. Tests: `npm test`.

## Set up the database (once)
1. Create a Supabase project. In **SQL Editor** run `supabase/migrations/001_paluwagan.sql` (fresh project; it is the complete schema).
2. **Authentication → Providers → Email**: keep "Confirm email" ON, set minimum password length to 8.
3. **Authentication → URL Configuration**: set Site URL to a page you own (used by the password-reset email).
4. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in GitHub → Settings → Secrets → Actions. Never use the `service_role` key in the app.
5. **Create YOUR account first** in the app (Create an account). The first account ever created becomes the Admin. Everyone after is a Member waiting for approval.

## Who can do what
| | Member | Cashier | Admin |
|---|---|---|---|
| See schedule, own payments | yes | yes | yes |
| Approve registrations, add/archive members | | yes | yes |
| Record payments, set schedule, release payouts | | yes | |
| Authorize / close cycles, users & roles, logo, title | | | yes |

All of this is enforced in the database (RLS + checked functions), not by hiding buttons.

## Security built in
* Row Level Security on every table; the app key can only read what its role allows and write only through checked functions.
* A new account sees no data until a Cashier/Admin approves it. Role and membership can't be changed by the user.
* Confirmed payouts can't be edited or deleted. Every important action is in the audit log.
* Password policy (8+, letter and number), login slow-down after 5 wrong tries, automatic sign-out after 10 idle minutes.
* APK: signed, release build, no app-data backup, HTTPS only, content-security-policy.
* Take your own database backups (Supabase → Database → Backups, or `pg_dump`).

## Builds and updates
Push to `main`. GitHub Actions tests, builds a signed APK and a web bundle, and publishes a Release. The app checks the Release: normal updates install by themselves, only native changes ask for a new APK. See `.github/workflows/android.yml`. The repo must be public for the app to see releases, and replace `signing/paluwagan-ci.keystore` with your own key before real use (see secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`).
