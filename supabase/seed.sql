-- =====================================================================
-- NextGen Predict — Seed data
-- Run after migrations:  supabase db reset   (or psql -f seed.sql)
-- =====================================================================

-- --------------------------------------------------------- site settings
update public.site_settings set
  site_name                   = 'NextGen Predict',
  site_tagline                = 'Predict. Trade. Win.',
  support_email               = 'support@nextgenpredict.com',
  twitter_url                 = 'https://twitter.com/nextgenpredict',
  telegram_url                = 'https://t.me/nextgenpredict',
  discord_url                 = 'https://discord.gg/nextgenpredict',
  trade_fee_percent           = 1.000,
  trade_fee_min               = 0.30,
  trade_fee_max               = 1.00,
  cancel_fee_min              = 0.30,
  cancel_fee_max              = 1.00,
  min_deposit                 = 10,
  min_withdrawal              = 20,
  welcome_bonus               = 5,
  deposit_bonus_percent       = 10,
  bonus_turnover_multiplier   = 5,
  referral_commission_percent = 5,
  kyc_required_for_withdrawal = true
where id = 1;

-- ------------------------------------------------------ deposit addresses
insert into public.deposit_addresses (network, asset, address, label) values
  ('robinhood', 'USDG', '0x7A3b9F2c8E1d4A5b6C7d8E9f0A1b2C3d4E5f6A7b', 'RH-USDG-01'),
  ('robinhood', 'USDG', '0x8B4c0A3d9F2e5B6c7D8e9F0a1B2c3D4e5F6a7B8c', 'RH-USDG-02'),
  ('robinhood', 'USDG', '0x9C5d1B4e0A3f6C7d8E9f0A1b2C3d4E5f6A7b8C9d', 'RH-USDG-03'),
  ('robinhood', 'USDG', '0xA0D6e2C5f1B4a7D8e9F0a1B2c3D4e5F6a7B8c9D0', 'RH-USDG-04'),
  ('robinhood', 'USDG', '0xB1E7f3D6a2C5b8E9f0A1b2C3d4E5f6A7b8C9d0E1', 'RH-USDG-05'),
  ('robinhood', 'ETH',  '0xC2F8a4E7b3D6c9F0a1B2c3D4e5F6a7B8c9D0e1F2', 'RH-ETH-01'),
  ('robinhood', 'ETH',  '0xD3A9b5F8c4E7d0A1b2C3d4E5f6A7b8C9d0E1f2A3', 'RH-ETH-02'),
  ('robinhood', 'ETH',  '0xE4B0c6A9d5F8e1B2c3D4e5F6a7B8c9D0e1F2a3B4', 'RH-ETH-03'),
  ('ethereum',  'USDC', '0xF5C1d7B0e6A9f2C3d4E5f6A7b8C9d0E1f2A3b4C5', 'ETH-USDC-01'),
  ('ethereum',  'USDC', '0x06D2e8C1f7B0a3D4e5F6a7B8c9D0e1F2a3B4c5D6', 'ETH-USDC-02'),
  ('ethereum',  'USDC', '0x17E3f9D2a8C1b4E5f6A7b8C9d0E1f2A3b4C5d6E7', 'ETH-USDC-03'),
  ('ethereum',  'USDT', '0x28F4a0E3b9D2c5F6a7B8c9D0e1F2a3B4c5D6e7F8', 'ETH-USDT-01'),
  ('ethereum',  'USDT', '0x39A5b1F4c0E3d6A7b8C9d0E1f2A3b4C5d6E7f8A9', 'ETH-USDT-02'),
  ('ethereum',  'USDT', '0x4AB6c2A5d1F4e7B8c9D0e1F2a3B4c5D6e7F8a9B0', 'ETH-USDT-03'),
  ('ethereum',  'ETH',  '0x5BC7d3B6e2A5f8C9d0E1f2A3b4C5d6E7f8A9b0C1', 'ETH-ETH-01'),
  ('ethereum',  'ETH',  '0x6CD8e4C7f3B6a9D0e1F2a3B4c5D6e7F8a9B0c1D2', 'ETH-ETH-02')
on conflict do nothing;

-- --------------------------------------------------------- promo banners
insert into public.promo_banners (title, subtitle, cta_text, link_url, bg_gradient, position, bonus_amount, user_limit, is_active) values
  ('Welcome Bonus — 5 USDG Free', 'Sign up today and start predicting instantly. No deposit required.',
   'Claim now', '/register', 'from-violet-600 via-fuchsia-600 to-pink-600', 1, 5, 1000, true),
  ('10% Deposit Bonus', 'Every deposit is topped up with an extra 10% bonus balance.',
   'Deposit now', '/wallet/deposit', 'from-cyan-500 via-blue-600 to-indigo-600', 2, 0, null, true),
  ('Refer & Earn 5%', 'Invite friends and earn 5% commission on every trade they make — forever.',
   'Get your link', '/dashboard/referrals', 'from-emerald-500 via-teal-600 to-cyan-600', 3, 0, null, true)
on conflict do nothing;

-- -------------------------------------------------------------- partners
insert into public.partners (name, logo_url, website_url, position) values
  ('ChainLabs',    '/partners/chainlabs.svg',    'https://example.com', 1),
  ('BlockFi Pro',  '/partners/blockfi.svg',      'https://example.com', 2),
  ('SportsData',   '/partners/sportsdata.svg',   'https://example.com', 3),
  ('SecureVault',  '/partners/securevault.svg',  'https://example.com', 4),
  ('OddsEngine',   '/partners/oddsengine.svg',   'https://example.com', 5),
  ('FanArena',     '/partners/fanarena.svg',     'https://example.com', 6)
on conflict do nothing;

-- --------------------------------------------------------------- markets
insert into public.markets
  (slug, sport, league, title, description, team_a, team_b, yes_label, no_label,
   yes_odds, no_odds, status, is_featured, is_trending, start_time, end_time, min_trade, max_trade)
values
  ('man-city-vs-arsenal-premier-league', 'football', 'Premier League',
   'Will Manchester City beat Arsenal?',
   'Resolves YES if Manchester City wins in regulation time. Draws resolve NO.',
   'Manchester City', 'Arsenal', 'City wins', 'Draw or Arsenal',
   0.5800, 0.4200, 'open', true, true, now() + interval '2 hours', now() + interval '2 days', 1, 50000),

  ('real-madrid-vs-barcelona-el-clasico', 'football', 'La Liga',
   'Will Real Madrid win El Clásico?',
   'Resolves YES if Real Madrid wins. Draws resolve NO.',
   'Real Madrid', 'Barcelona', 'Madrid wins', 'Draw or Barça',
   0.5200, 0.4800, 'open', true, true, now() + interval '1 day', now() + interval '3 days', 1, 50000),

  ('india-vs-australia-odi-series', 'cricket', 'ICC ODI',
   'Will India win the ODI series against Australia?',
   'Resolves YES if India wins the series outright. Tied series resolves NO.',
   'India', 'Australia', 'India wins', 'Australia or tie',
   0.6300, 0.3700, 'open', true, true, now() + interval '5 hours', now() + interval '6 days', 1, 50000),

  ('england-vs-pakistan-t20', 'cricket', 'T20 International',
   'Will England chase down 180+ against Pakistan?',
   'Resolves YES if England successfully chases a target of 180 or more.',
   'England', 'Pakistan', 'Chase succeeds', 'Chase fails',
   0.4500, 0.5500, 'open', false, true, now() + interval '8 hours', now() + interval '2 days', 1, 25000),

  ('lakers-vs-celtics-nba', 'basketball', 'NBA',
   'Will the Lakers beat the Celtics?',
   'Resolves YES if the Los Angeles Lakers win. Overtime counts.',
   'LA Lakers', 'Boston Celtics', 'Lakers win', 'Celtics win',
   0.4900, 0.5100, 'open', true, false, now() + interval '12 hours', now() + interval '2 days', 1, 50000),

  ('warriors-vs-nuggets-nba', 'basketball', 'NBA',
   'Will Golden State score over 115 points?',
   'Resolves YES if the Warriors score 116 or more points including overtime.',
   'Golden State', 'Denver Nuggets', 'Over 115', 'Under 115',
   0.5500, 0.4500, 'open', false, true, now() + interval '1 day', now() + interval '2 days', 1, 25000),

  ('alcaraz-vs-djokovic-wimbledon', 'tennis', 'Wimbledon',
   'Will Alcaraz defeat Djokovic?',
   'Resolves YES if Carlos Alcaraz wins the match. Retirement counts for the advancing player.',
   'C. Alcaraz', 'N. Djokovic', 'Alcaraz wins', 'Djokovic wins',
   0.5400, 0.4600, 'open', true, true, now() + interval '6 hours', now() + interval '3 days', 1, 50000),

  ('sinner-vs-medvedev-atp-final', 'tennis', 'ATP Finals',
   'Will Sinner win in straight sets?',
   'Resolves YES only if Jannik Sinner wins without dropping a set.',
   'J. Sinner', 'D. Medvedev', 'Straight sets', 'Any other result',
   0.3800, 0.6200, 'open', false, false, now() + interval '2 days', now() + interval '4 days', 1, 25000),

  ('t1-vs-g2-worlds-final', 'esports', 'LoL Worlds',
   'Will T1 win the Worlds final against G2?',
   'Resolves YES if T1 wins the best-of-five series.',
   'T1', 'G2 Esports', 'T1 wins', 'G2 wins',
   0.6700, 0.3300, 'open', true, true, now() + interval '3 days', now() + interval '5 days', 1, 50000),

  ('navi-vs-faze-cs2-major', 'esports', 'CS2 Major',
   'Will NAVI beat FaZe Clan?',
   'Resolves YES if Natus Vincere wins the series.',
   'NAVI', 'FaZe Clan', 'NAVI wins', 'FaZe wins',
   0.5100, 0.4900, 'open', false, true, now() + interval '1 day', now() + interval '4 days', 1, 25000),

  ('bayern-vs-dortmund-der-klassiker', 'football', 'Bundesliga',
   'Will Bayern Munich win Der Klassiker?',
   'Resolves YES if Bayern Munich wins. Draws resolve NO.',
   'Bayern Munich', 'B. Dortmund', 'Bayern wins', 'Draw or Dortmund',
   0.6100, 0.3900, 'open', false, false, now() + interval '4 days', now() + interval '6 days', 1, 50000),

  ('psg-vs-inter-ucl', 'football', 'Champions League',
   'Will PSG advance to the semi-final?',
   'Resolves YES if PSG advances on aggregate, including penalties.',
   'PSG', 'Inter Milan', 'PSG advance', 'Inter advance',
   0.4700, 0.5300, 'open', false, false, now() + interval '5 days', now() + interval '7 days', 1, 50000)
on conflict (slug) do nothing;

-- =====================================================================
-- Promote an admin (run manually after your first sign-up):
--
--   update public.profiles
--      set role = 'super_admin'
--    where email = 'you@example.com';
-- =====================================================================
