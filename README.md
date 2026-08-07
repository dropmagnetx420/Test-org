# NextGen Predict

A production-ready sports prediction market platform. Users stake USDG on binary YES/NO
outcomes across five sports; admins run the markets, approve deposits and withdrawals,
verify identities, and resolve outcomes.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, and Supabase.

---

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Supabase setup](#supabase-setup)
- [Project structure](#project-structure)
- [How the money works](#how-the-money-works)
- [Admin console](#admin-console)
- [Security model](#security-model)
- [Deployment](#deployment)

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase keys
npm run dev
```

Open <http://localhost:3000>.

| Script              | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Dev server                                      |
| `npm run build`     | Production build                                |
| `npm run start`     | Serve the production build                      |
| `npm run lint`      | ESLint                                          |
| `npm run typecheck` | `tsc --noEmit`                                  |

> On platforms without Turbopack native bindings (e.g. Android/arm64), build with
> `npx next build --webpack`.

---

## Environment variables

All five are required. See `.env.example`.

| Variable                        | Scope  | Purpose                                                        |
| ------------------------------- | ------ | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Client | Supabase project URL                                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Anon key — safe to expose, RLS is the real boundary             |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server | Bypasses RLS. Aggregate landing-page stats and the cron job     |
| `NEXT_PUBLIC_SITE_URL`          | Client | Absolute URL for auth callbacks and referral links              |
| `CRON_SECRET`                   | Server | Bearer token guarding `/api/cron/close-markets`                 |

The service role key must never be prefixed with `NEXT_PUBLIC_` or imported into a
client component.

---

## Supabase setup

### 1. Run the migrations

```bash
supabase link --project-ref <your-project-ref>
supabase db push
supabase db seed        # optional demo markets, banners, partners
```

Or paste each file into the SQL editor in order:

| File                                  | Contents                                                          |
| ------------------------------------- | ----------------------------------------------------------------- |
| `20250101000000_initial_schema.sql`   | 19 tables, enums, indexes, triggers                                |
| `20250101000001_functions.sql`        | `SECURITY DEFINER` RPCs — the only path that moves money           |
| `20250101000002_rls_policies.sql`     | RLS on every table, plus the three storage buckets and policies    |

### 2. Auth providers

Dashboard → Authentication → Providers:

- **Email** — enable, with "Confirm email" on.
- **Google** — enable and paste your OAuth client ID and secret.

Dashboard → Authentication → URL Configuration:

- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/auth/callback` (and the localhost equivalent)

### 3. Storage

The migrations create all three buckets. `kyc-documents` and `deposit-receipts` are
**private** — files are only ever served through short-lived (300s) signed URLs
generated server-side after an ownership or admin check.

| Bucket              | Visibility | Holds                          |
| ------------------- | ---------- | ------------------------------ |
| `kyc-documents`     | Private    | ID documents and selfies       |
| `deposit-receipts`  | Private    | Deposit proof screenshots      |
| `public-assets`     | Public     | Banner and partner images      |

### 4. Create your first admin

Sign up through the UI, then promote yourself:

```sql
update public.profiles set role = 'super_admin' where email = 'you@example.com';
```

`/admin` is then reachable. Super admins can promote others from **Admin → Users**.

### 5. Deposit addresses

Deposits will not work until at least one active address exists per asset. Add
10–15 in **Admin → Settings → Deposit addresses**; a random active one is served
on each deposit so no single address is reused every time.

---

## Project structure

```
app/
  (public)/          Landing page, market browse and detail
  (auth)/            Login, register, forgot/reset password
  (app)/             Authenticated: dashboard, wallet, KYC, referrals, profile
  admin/             Admin console (not a route group — /admin is a real path)
  auth/callback/     OAuth and email-confirmation handler
components/
  ui/                shadcn/ui primitives
  shared/            Cross-cutting: header, footer, pagination, status badge…
  admin/ dashboard/ wallet/ kyc/ landing/ …
lib/
  actions/           Server Actions, grouped by domain
  supabase/          Browser, server, and proxy clients
  auth.ts            Session helpers, role guards, rate limiting
  validations.ts     Zod schemas — every action validates against these
  constants.ts       Sports, networks, assets, buckets, rate limits
types/database.ts    Row types mirroring the SQL schema
supabase/            Migrations and seed
proxy.ts             Route protection (Next.js 16 renamed middleware → proxy)
```

---

## How the money works

Balances are **never** written from application code. Every mutation goes through a
`SECURITY DEFINER` Postgres function, so the invariants hold even if a route is
compromised.

| RPC                          | Effect                                                       |
| ---------------------------- | ------------------------------------------------------------ |
| `place_trade`                | Debits stake + fee, opens the position                       |
| `cancel_trade`               | Refunds the stake minus the cancel fee                       |
| `resolve_market`             | Pays winners, marks losers, notifies everyone                |
| `cancel_market`              | Refunds every open position in full                          |
| `approve_deposit`            | Credits the balance and applies the deposit bonus            |
| `approve_withdrawal`         | Releases the locked amount                                   |
| `reject_withdrawal`          | Returns the full amount to the available balance             |
| `adjust_user_balance`        | Manual admin credit or debit, written to the ledger          |

**Fees.** Opening or cancelling a position costs a configurable percentage of the
stake, clamped between a minimum and maximum (0.30–1.00 USDG by default). Positions
can be cancelled at any time while the market is open.

**Spend order.** Cash is spent before bonus funds.

**Bonus turnover.** Bonus credits carry a turnover requirement (bonus × multiplier).
Withdrawals are blocked until it is met, so bonuses cannot be cashed out directly.

**Withdrawals.** Requesting one locks the amount immediately. An admin sends the
payout on-chain, then approves with the transaction hash. Rejecting returns
everything, fee included.

---

## Admin console

| Page                          | What it does                                                     |
| ----------------------------- | ---------------------------------------------------------------- |
| `/admin`                      | Revenue, cash flow, activity, and the pending review queues       |
| `/admin/markets`              | Create, price, edit, resolve, cancel; bulk-close expired markets  |
| `/admin/users`                | Search, ban/suspend, adjust balances, grant roles                 |
| `/admin/deposits`             | Verify the tx hash on-chain, then approve to credit               |
| `/admin/withdrawals`          | Send the payout, then approve with the hash; reject refunds       |
| `/admin/kyc`                  | Compare selfie against document, approve or reject with a reason  |
| `/admin/notifications`        | Broadcast an announcement to every active user                    |
| `/admin/settings`             | Fees, limits, bonuses, social links, access switches              |
| `/admin/settings/addresses`   | The 10–15 rotating deposit addresses                              |
| `/admin/settings/banners`     | Promo banners with a claim cap that auto-hides the banner         |
| `/admin/settings/partners`    | Partner logos for the landing page                                |
| `/admin/logs`                 | Immutable audit trail of every admin action                       |

Role changes require `super_admin`. Every admin action is written to `admin_logs`
with the actor, IP, and payload.

---

## Security model

- **RLS on all 19 tables.** Users read only their own rows; admins are matched by a
  role check inside the policy, not by a client-supplied flag.
- **Balances only move via `SECURITY DEFINER` RPCs.** No table-level write grants on
  `wallets` or `transactions`.
- **Every Server Action validates with Zod** before touching the database, and
  re-checks authorisation server-side — never trusting a hidden form field.
- **Rate limiting** on auth, trades, deposits, and withdrawals, tracked in
  `rate_limit_events` and keyed by user ID or IP.
- **Private storage with signed URLs.** KYC documents and receipts are never public;
  each preview generates a 300-second URL after an ownership or admin check.
- **Audit logging** of every administrative mutation.
- **Route protection** in `proxy.ts` plus a server-side `requireAdmin()` guard on each
  admin page — the proxy is a convenience, not the boundary.
- **Security headers** (HSTS, `X-Frame-Options: DENY`, `nosniff`, a restrictive
  `Permissions-Policy`) set in `next.config.ts`.
- **Banned accounts** are redirected to `/banned` on every authenticated request.
- **Maintenance mode** locks out everyone except admins.

---

## Deployment

### Vercel

1. Push to GitHub and import the repository.
2. Add the five environment variables from `.env.example` for Production, Preview,
   and Development.
3. Set `NEXT_PUBLIC_SITE_URL` to the production domain.
4. Add that domain to the Supabase redirect allow-list.
5. Deploy — the defaults for build and output are correct as-is.

`vercel.json` registers one cron: `/api/cron/close-markets` every 10 minutes, so
markets stop accepting trades after their end time without anyone pressing a
button. Vercel sends `Authorization: Bearer $CRON_SECRET`; the route rejects
anything else. On other hosts, call the same URL from `pg_cron` or any scheduler
with that header.

### Post-deploy checklist

- [ ] Migrations applied to the production database
- [ ] A `super_admin` promoted
- [ ] Deposit addresses added for every network and asset
- [ ] Fees, limits, and bonuses reviewed in **Admin → Settings**
- [ ] Google OAuth redirect URL points at the production domain
- [ ] A test deposit approved end to end
- [ ] `CRON_SECRET` set, and the close-markets cron confirmed green in the Vercel
      dashboard
