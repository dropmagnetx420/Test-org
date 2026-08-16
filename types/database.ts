export type UserRole = "user" | "admin" | "super_admin";
export type UserStatus = "active" | "suspended" | "banned";
export type KycStatus = "unverified" | "pending" | "approved" | "rejected";
export type MarketStatus = "draft" | "open" | "closed" | "resolved" | "cancelled";
export type TradeSide = "yes" | "no";
export type TradeStatus = "open" | "cancelled" | "won" | "lost" | "refunded";
export type RequestStatus = "pending" | "approved" | "rejected";
export type NetworkType = "robinhood" | "ethereum";
export type IdDocumentType = "national_id" | "passport" | "driving_license" | "other";
export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "trade_buy"
  | "trade_cancel"
  | "trade_payout"
  | "trade_refund"
  | "fee"
  | "bonus"
  | "referral"
  | "admin_adjustment";
export type NotificationType =
  | "deposit_approved"
  | "deposit_rejected"
  | "withdrawal_approved"
  | "withdrawal_rejected"
  | "prediction_won"
  | "prediction_lost"
  | "prediction_refunded"
  | "kyc_approved"
  | "kyc_rejected"
  | "bonus_credited"
  | "referral_earned"
  | "announcement"
  | "task_approved"
  | "task_rejected";

export type EarnTaskType =
  | "twitter_follow"
  | "twitter_retweet"
  | "telegram_join"
  | "discord_join"
  | "youtube_subscribe"
  | "instagram_follow"
  | "facebook_follow"
  | "custom";

export type AdProvider = "admob" | "adsterra" | "startio";

export type AdPlacementSlot =
  | "header"
  | "sidebar"
  | "in_feed"
  | "footer"
  | "market_detail"
  | "earn_page";

export type AdFormat = "banner" | "native" | "interstitial" | "rewarded_video";

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  country: string | null;
  role: UserRole;
  status: UserStatus;
  kyc_status: KycStatus;
  referral_code: string;
  referred_by: string | null;
  total_trades: number;
  total_volume: string;
  total_won: string;
  total_lost: string;
  suspended_until: string | null;
  ban_reason: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  available_balance: string;
  bonus_balance: string;
  locked_balance: string;
  total_deposited: string;
  total_withdrawn: string;
  bonus_turnover_required: string;
  bonus_turnover_completed: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Market {
  id: string;
  slug: string;
  sport: string;
  league: string | null;
  title: string;
  description: string | null;
  rules: string | null;
  image_url: string | null;
  team_a: string | null;
  team_b: string | null;
  team_a_logo: string | null;
  team_b_logo: string | null;
  yes_label: string;
  no_label: string;
  yes_odds: string;
  no_odds: string;
  yes_volume: string;
  no_volume: string;
  total_volume: string;
  trade_count: number;
  min_trade: string;
  max_trade: string;
  status: MarketStatus;
  is_featured: boolean;
  is_trending: boolean;
  start_time: string;
  end_time: string;
  resolved_outcome: TradeSide | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  outcome_count: number;
  seed_volume: string;
  real_volume: string;
  lifetime_volume: string;
  resolved_option_id: string | null;
}

export interface MarketOption {
  id: string;
  market_id: string;
  label: string;
  odds: string;
  volume: string;
  seed_volume: string;
  real_volume: string;
  lifetime_volume: string;
  is_winner: boolean;
  is_active: boolean;
  position: number;
  created_at: string;
}

export interface MarketOddsPoint {
  option_id: string;
  odds: string;
  recorded_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  market_id: string;
  option_id: string | null;
  side: TradeSide | null;
  amount: string;
  price: string;
  shares: string;
  potential_payout: string;
  fee: string;
  cancel_fee: string;
  status: TradeStatus;
  payout: string;
  settled_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: string;
  balance_before: string;
  balance_after: string;
  is_bonus: boolean;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  created_at: string;
}

export interface DepositRequest {
  id: string;
  user_id: string;
  amount: string;
  network: NetworkType;
  asset: string;
  tx_hash: string;
  deposit_address: string;
  receipt_url: string | null;
  status: RequestStatus;
  bonus_applied: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WithdrawRequest {
  id: string;
  user_id: string;
  amount: string;
  fee: string;
  net_amount: string;
  network: NetworkType;
  asset: string;
  wallet_address: string;
  status: RequestStatus;
  tx_hash: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KycRequest {
  id: string;
  user_id: string;
  document_type: IdDocumentType;
  document_number: string;
  full_name: string;
  date_of_birth: string | null;
  country: string;
  address: string | null;
  document_front_url: string;
  document_back_url: string | null;
  selfie_url: string;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  is_broadcast: boolean;
  created_at: string;
}

export interface BonusHistory {
  id: string;
  user_id: string;
  bonus_type: string;
  amount: string;
  turnover_required: string;
  turnover_completed: string;
  status: string;
  reference_id: string | null;
  description: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  code_used: string;
  commission_earned: string;
  total_volume: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DepositAddress {
  id: string;
  network: NetworkType;
  asset: string;
  address: string;
  label: string | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

export interface EarnTask {
  id: string;
  type: EarnTaskType;
  title: string;
  description: string | null;
  instructions: string | null;
  target_url: string | null;
  reward: string;
  requires_proof: boolean;
  is_repeatable: boolean;
  cooldown_hours: number;
  user_limit: number | null;
  claimed_count: number;
  is_active: boolean;
  position: number;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmission {
  id: string;
  task_id: string;
  user_id: string;
  proof_url: string | null;
  proof_note: string | null;
  status: RequestStatus;
  reward: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdPlacementConfig {
  id: string;
  placement: AdPlacementSlot;
  provider: AdProvider;
  format: AdFormat;
  unit_id: string | null;
  script_url: string | null;
  script_key: string | null;
  is_active: boolean;
  position: number;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

export interface AdView {
  id: string;
  user_id: string;
  placement: AdPlacementSlot;
  provider: AdProvider | null;
  reward: string;
  watch_ms: number;
  view_date: string;
  day_seq: number;
  created_at: string;
}

/** A task plus the caller's own submission state, for the /earn page. */
export interface EarnTaskWithState extends EarnTask {
  submission: Pick<TaskSubmission, "id" | "status" | "reviewed_at" | "admin_note"> | null;
}

export interface TaskSubmissionWithRelations extends TaskSubmission {
  task: Pick<EarnTask, "id" | "title" | "type" | "target_url"> | null;
  user: Pick<Profile, "id" | "email" | "username"> | null;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_text: string | null;
  bg_gradient: string | null;
  position: number;
  is_active: boolean;
  bonus_amount: string;
  user_limit: number | null;
  claimed_count: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignMetric = "trading_volume" | "referral_count" | "referral_volume";

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  metric: CampaignMetric;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  prize_note: string | null;
  winner_id: string | null;
  winner_note: string | null;
  created_at: string;
  updated_at: string;
}

/** A single row from the `leaderboard_rankings` RPC. `handle` is anonymised
 *  (username, or a Member-prefixed id) so the row is safe to show publicly. */
export interface LeaderboardRow {
  rank: number;
  user_id: string;
  handle: string;
  score: number;
}

export interface Partner {
  id: string;
  name: string;
  logo_url: string;
  website_url: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
}

export interface SiteSettings {
  id: number;
  site_name: string;
  site_tagline: string | null;
  logo_url: string | null;
  support_email: string | null;
  twitter_url: string | null;
  telegram_url: string | null;
  discord_url: string | null;
  trade_fee_percent: string;
  trade_fee_min: string;
  trade_fee_max: string;
  cancel_fee_min: string;
  cancel_fee_max: string;
  min_deposit: string;
  min_withdrawal: string;
  withdrawal_fee_percent: string;
  welcome_bonus: string;
  deposit_bonus_percent: string;
  first_deposit_bonus_percent: string;
  first_deposit_bonus_max: string;
  bonus_turnover_multiplier: string;
  referral_commission_percent: string;
  referral_signup_reward: string;
  kyc_required_for_withdrawal: boolean;
  maintenance_mode: boolean;
  registration_enabled: boolean;
  ads_enabled: boolean;
  ad_reward: string;
  ad_watch_seconds: number;
  ad_daily_limit: number;
  earn_tasks_enabled: boolean;
  task_reward_is_bonus: boolean;
  updated_at: string;
}

export interface MarketWithOptions extends Market {
  options: MarketOption[];
}

export interface MarketWithPosition extends Market {
  user_position?: {
    yes_shares: string;
    no_shares: string;
    total_invested: string;
  } | null;
}

export interface TradeWithMarket extends Trade {
  market: Pick<
    Market,
    | "id"
    | "slug"
    | "title"
    | "sport"
    | "team_a"
    | "team_b"
    | "status"
    | "end_time"
    | "resolved_outcome"
    | "yes_label"
    | "no_label"
  >;
  option: Pick<MarketOption, "id" | "label" | "is_winner"> | null;
}

export interface TradeWithOption extends Trade {
  option: Pick<MarketOption, "id" | "label" | "odds" | "is_winner">;
}

export interface ProfileWithWallet extends Profile {
  wallet: Wallet | null;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
