export const SITE_NAME = "NextGen Predict";
export const SITE_DESCRIPTION =
  "Trade on the outcome of live sports events. Football, cricket, basketball, tennis and esports prediction markets.";

export const SPORTS = [
  { value: "football", label: "Football", icon: "⚽", gradient: "from-emerald-500 to-teal-500" },
  { value: "cricket", label: "Cricket", icon: "🏏", gradient: "from-amber-500 to-orange-500" },
  { value: "basketball", label: "Basketball", icon: "🏀", gradient: "from-orange-500 to-red-500" },
  { value: "tennis", label: "Tennis", icon: "🎾", gradient: "from-lime-500 to-green-500" },
  { value: "esports", label: "Esports", icon: "🎮", gradient: "from-violet-500 to-fuchsia-500" },
] as const;

export type SportValue = (typeof SPORTS)[number]["value"];

export const NETWORKS = [
  {
    value: "robinhood",
    label: "Robinhood Chain",
    assets: ["ETH", "USDG"],
    explorer: "https://robinhood-chain-explorer.io/tx/",
  },
  {
    value: "ethereum",
    label: "Ethereum",
    assets: ["USDC", "USDT", "ETH"],
    explorer: "https://etherscan.io/tx/",
  },
] as const;

export type NetworkValue = (typeof NETWORKS)[number]["value"];

export const ASSETS_BY_NETWORK: Record<NetworkValue, readonly string[]> = {
  robinhood: ["ETH", "USDG"],
  ethereum: ["USDC", "USDT", "ETH"],
};

export const MARKET_STATUS = {
  DRAFT: "draft",
  OPEN: "open",
  CLOSED: "closed",
  RESOLVED: "resolved",
  CANCELLED: "cancelled",
} as const;

export const TRADE_STATUS = {
  OPEN: "open",
  CANCELLED: "cancelled",
  WON: "won",
  LOST: "lost",
  REFUNDED: "refunded",
} as const;

export const REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const KYC_STATUS = {
  UNVERIFIED: "unverified",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;

export const USER_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  BANNED: "banned",
} as const;

export const TRANSACTION_TYPES = {
  DEPOSIT: "deposit",
  WITHDRAWAL: "withdrawal",
  TRADE_BUY: "trade_buy",
  TRADE_CANCEL: "trade_cancel",
  TRADE_PAYOUT: "trade_payout",
  TRADE_REFUND: "trade_refund",
  FEE: "fee",
  BONUS: "bonus",
  REFERRAL: "referral",
  ADMIN_ADJUSTMENT: "admin_adjustment",
} as const;

export const ID_DOCUMENT_TYPES = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "driving_license", label: "Driving License" },
] as const;

export const DEFAULTS = {
  TRADE_FEE_MIN: 0.3,
  TRADE_FEE_MAX: 1.0,
  TRADE_FEE_PERCENT: 1.0,
  CANCEL_FEE_MIN: 0.3,
  CANCEL_FEE_MAX: 1.0,
  MIN_TRADE_AMOUNT: 1,
  MAX_TRADE_AMOUNT: 100000,
  MIN_DEPOSIT: 10,
  MIN_WITHDRAWAL: 20,
  WELCOME_BONUS: 0,
  DEPOSIT_BONUS_PERCENT: 0,
  REFERRAL_COMMISSION_PERCENT: 5,
  BONUS_TURNOVER_MULTIPLIER: 5,
  PAGE_SIZE: 20,
} as const;

export const STORAGE_BUCKETS = {
  KYC: "kyc-documents",
  RECEIPTS: "deposit-receipts",
  PUBLIC: "public-assets",
  TASK_PROOFS: "task-proofs",
} as const;

export const RATE_LIMITS = {
  AUTH: { limit: 8, windowMs: 60_000 },
  TRADE: { limit: 30, windowMs: 60_000 },
  DEPOSIT: { limit: 6, windowMs: 300_000 },
  WITHDRAW: { limit: 4, windowMs: 300_000 },
  KYC: { limit: 4, windowMs: 900_000 },
  TASK: { limit: 10, windowMs: 300_000 },
  AD_CLAIM: { limit: 30, windowMs: 300_000 },
  DEFAULT: { limit: 60, windowMs: 60_000 },
} as const;

export const EARN_TASK_TYPES = [
  { value: "twitter_follow", label: "Follow on X", icon: "𝕏" },
  { value: "twitter_retweet", label: "Repost on X", icon: "🔁" },
  { value: "telegram_join", label: "Join Telegram", icon: "✈️" },
  { value: "discord_join", label: "Join Discord", icon: "💬" },
  { value: "youtube_subscribe", label: "Subscribe on YouTube", icon: "▶️" },
  { value: "instagram_follow", label: "Follow on Instagram", icon: "📷" },
  { value: "facebook_follow", label: "Follow on Facebook", icon: "👍" },
  { value: "custom", label: "Custom task", icon: "⭐" },
] as const;

export const AD_PROVIDERS = [
  { value: "admob", label: "Google AdMob" },
  { value: "adsterra", label: "Adsterra" },
  { value: "startio", label: "Start.io" },
] as const;

export const AD_PLACEMENTS = [
  { value: "header", label: "Header banner" },
  { value: "sidebar", label: "Sidebar" },
  { value: "in_feed", label: "In-feed (markets list)" },
  { value: "footer", label: "Footer banner" },
  { value: "market_detail", label: "Market detail" },
  { value: "earn_page", label: "Earn page (rewarded)" },
] as const;

export const AD_FORMATS = [
  { value: "banner", label: "Banner" },
  { value: "native", label: "Native" },
  { value: "interstitial", label: "Interstitial" },
  { value: "rewarded_video", label: "Rewarded video" },
] as const;

/**
 * The only account that can claim super_admin via /foisal420. Hardcoded rather
 * than env-driven so a misconfigured deploy can never widen who may claim it.
 */
export const OWNER_EMAIL = "foysalqbl@gmail.com";
