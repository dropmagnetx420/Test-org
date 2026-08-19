-- =====================================================================
-- NextGen Predict — Legal pages (Terms of Service, Privacy Policy)
-- Two admin-authored Markdown documents rendered at /terms and /privacy.
-- One row per page, keyed by slug and seeded here so the public routes
-- always resolve. Content is world-readable; only admins may edit it.
-- =====================================================================

create table if not exists public.legal_pages (
  slug        text primary key check (slug in ('terms', 'privacy')),
  title       text not null,
  content     text not null default '',
  updated_at  timestamptz not null default now()
);

create or replace trigger legal_pages_touch
  before update on public.legal_pages
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ RLS
alter table public.legal_pages enable row level security;

-- Legal copy is public; anyone (including anon) may read it.
drop policy if exists "legal_pages_select_all" on public.legal_pages;
create policy "legal_pages_select_all" on public.legal_pages
  for select using (true);

-- Only admins write. Mirrors campaigns_admin_write.
drop policy if exists "legal_pages_admin_write" on public.legal_pages;
create policy "legal_pages_admin_write" on public.legal_pages
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ Seed
insert into public.legal_pages (slug, title, content) values
  (
    'terms',
    'Terms of Service',
    E'## 1. Acceptance of terms\n\nBy accessing or using this platform you agree to be bound by these Terms of Service. If you do not agree, do not use the service.\n\n## 2. Eligibility\n\nYou must be of legal age in your jurisdiction to use this platform. You are responsible for ensuring that your use complies with the laws that apply to you.\n\n## 3. Accounts\n\nYou are responsible for keeping your account credentials secure and for all activity that occurs under your account.\n\n## 4. Risk\n\nPrediction markets carry financial risk. Only trade what you can afford to lose.\n\n## 5. Changes\n\nWe may update these terms from time to time. Continued use after a change means you accept the updated terms.'
  ),
  (
    'privacy',
    'Privacy Policy',
    E'## 1. Information we collect\n\nWe collect the information you provide when you register, verify your identity, and use the platform, along with technical data such as your IP address and device information.\n\n## 2. How we use your information\n\nWe use your information to operate the platform, verify your identity, process deposits and withdrawals, prevent fraud, and comply with legal obligations.\n\n## 3. Sharing\n\nWe do not sell your personal data. We share it only with service providers who help us run the platform and where required by law.\n\n## 4. Security\n\nWe apply reasonable technical and organisational measures to protect your data, but no method of transmission or storage is completely secure.\n\n## 5. Contact\n\nIf you have questions about this policy, contact us through the support channels listed on the site.'
  )
on conflict (slug) do nothing;
