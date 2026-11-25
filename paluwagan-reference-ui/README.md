# Paluwagan (React + Vite + Tailwind + Capacitor + Supabase)

Your layout, now with the payout-cycle logic, Supabase security, and automatic update detection.
Footer on Login and Settings: **System Developer Dexter M. Mornaol** (one constant: `src/config.ts`).

## Try it now (no setup)
```bash
npm install && npm run dev      # no Supabase keys = offline demo, pick Admin / Cashier / Member on the login screen
npm test                        # 12 payout-rule tests
```

## Go live
1. **Supabase**: create a project, run `supabase/migrations/001_paluwagan.sql` in the SQL editor.
2. Create users (Authentication > Users). Make staff, and link each member's login to their member row:
   ```sql
   update profiles set role = 'ADMIN'   where id = '<admin auth user id>';
   update profiles set role = 'CASHIER' where id = '<cashier auth user id>';
   update profiles set member_id = '<members.id>' where id = '<member auth user id>';
   ```
3. **GitHub** (repo must be **public** so the app can see releases): Settings > Secrets > Actions, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Push to `main`. GitHub Actions runs the tests, builds a signed APK and publishes it as Release `build-N`.

## Auto-update
Every build gets a higher build number. The app checks the latest GitHub Release on launch, every 30 min, and when reopened. If newer, a green banner shows an **Update** button that downloads the APK. Android asks to install it; it installs over the old one and keeps your data.
* Updates only install over the old app if the **signing key is the same every build**. Until you add your own, the workflow uses `signing/paluwagan-ci.keystore`, which is public in the repo: fine for testing, not for real money. Make your own:
  `keytool -genkeypair -keystore my.keystore -alias paluwagan -keyalg RSA -keysize 2048 -validity 36500`
  then add secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 my.keystore`), `ANDROID_KEYSTORE_PASSWORD` (store and key password must match), `ANDROID_KEY_ALIAS`. Switching keys later means one reinstall.

## Rules implemented (engine `src/lib/engine.ts`, mirrored in SQL)
Per-cycle IDs and records; auto-distribution by recipients per month; one assignment per member; schedule extends past 12 months; Nov 31 to Nov 30, Feb 28/29; Scheduled is not Paid (only the Cashier confirms a release); progress uses actual releases; statuses DRAFT / ACTIVE / AWAITING_COMPLETION / FOR_ADMIN_REVIEW / CLOSED (only the Admin closes); edits never touch released payouts; archiving keeps the obligation; new members need an Admin decision (current or next cycle); audit log; confirmed transactions can't be edited or deleted.

**Security is in Postgres** (RLS + `security definer` functions), not the buttons. The Cashier cannot close a cycle, activate the next one, or edit the group title.

## Not done
In-app Messages is still the static layout (no messages table). Payment reminders are stored (`due_day`, `reminder_days`) and shown, but no push notifications are sent.
