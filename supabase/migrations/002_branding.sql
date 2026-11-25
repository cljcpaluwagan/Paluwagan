-- Only needed if you already ran 001 before branding existed. Safe to run twice.
alter table app_settings add column if not exists logo_data text, add column if not exists bg_data text;
