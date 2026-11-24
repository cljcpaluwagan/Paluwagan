export const DEVELOPER_CREDIT = 'System Developer Dexter M. Mornaol';
export const APP_BUILD = Number(import.meta.env.VITE_BUILD_NUMBER || 0);   // set by GitHub Actions (run number)
export const APP_VERSION = `1.0.${APP_BUILD}`;
export const GITHUB_REPO: string = import.meta.env.VITE_GITHUB_REPO || '';  // 'owner/repo' — must be public for update checks
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const DEMO_MODE = !SUPABASE_URL || !SUPABASE_ANON_KEY;                // no Supabase keys -> offline demo data
