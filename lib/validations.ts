import { z } from "zod";
import { NETWORKS, DEFAULTS } from "@/lib/constants";

const networkEnum = z.enum(["robinhood", "ethereum"]);
const evmAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid wallet address");
const txHash = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Enter a valid transaction hash");

const assetForNetwork = (network: string, asset: string) =>
  NETWORKS.find((n) => n.value === network)?.assets.includes(asset as never) ?? false;

// ------------------------------------------------------------------ auth
export const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password is too long")
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
    fullName: z.string().trim().min(2, "Enter your full name").max(80),
    referralCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6,12}$/, "Invalid referral code")
      .optional()
      .or(z.literal("")),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72)
      .regex(/[a-z]/, "Include at least one lowercase letter")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

// --------------------------------------------------------------- profile
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "3–24 characters: letters, numbers, underscore")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
});

// ----------------------------------------------------------------- trade
export const placeTradeSchema = z.object({
  marketId: z.string().uuid("Invalid market"),
  optionId: z.string().uuid("Invalid option"),
  amount: z
    .number()
    .positive("Enter an amount greater than zero")
    .min(DEFAULTS.MIN_TRADE_AMOUNT, `Minimum trade is ${DEFAULTS.MIN_TRADE_AMOUNT} USDG`)
    .max(DEFAULTS.MAX_TRADE_AMOUNT, "Amount exceeds the maximum"),
});

export const cancelTradeSchema = z.object({
  tradeId: z.string().uuid("Invalid trade"),
});

// --------------------------------------------------------------- deposit
export const depositSchema = z
  .object({
    amount: z.number().positive("Enter an amount greater than zero").max(1_000_000),
    network: networkEnum,
    asset: z.string().trim().min(2).max(10),
    txHash,
    depositAddress: evmAddress,
    receiptUrl: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => assetForNetwork(d.network, d.asset), {
    message: "This asset is not supported on the selected network",
    path: ["asset"],
  });

// ------------------------------------------------------------- withdrawal
export const withdrawSchema = z
  .object({
    amount: z.number().positive("Enter an amount greater than zero").max(1_000_000),
    network: networkEnum,
    asset: z.string().trim().min(2).max(10),
    walletAddress: evmAddress,
  })
  .refine((d) => assetForNetwork(d.network, d.asset), {
    message: "This asset is not supported on the selected network",
    path: ["asset"],
  });

// -------------------------------------------------------------------- kyc
export const kycSchema = z.object({
  documentType: z.enum(["national_id", "passport", "driving_license"]),
  documentNumber: z.string().trim().min(4, "Enter your document number").max(50),
  fullName: z.string().trim().min(2, "Enter your full legal name").max(80),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((v) => {
      const dob = new Date(v);
      const age = (Date.now() - dob.getTime()) / 31_557_600_000;
      return age >= 18 && age <= 120;
    }, "You must be at least 18 years old"),
  country: z.string().trim().min(2, "Select your country").max(60),
  address: z.string().trim().max(240).optional().or(z.literal("")),
  documentFrontUrl: z.string().trim().min(1, "Upload the front of your document"),
  documentBackUrl: z.string().trim().optional().or(z.literal("")),
  selfieUrl: z.string().trim().min(1, "Upload a live selfie"),
});

// ----------------------------------------------------------- admin market
const marketOutcomeSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(40),
  odds: z.number().min(0.01, "Odds must be above 0.01").max(0.99, "Odds must be below 0.99").optional(),
  seedVolume: z.number().min(0).max(1_000_000).optional(),
});

export const marketSchema = z
  .object({
    sport: z.enum(["football", "cricket", "basketball", "tennis", "esports"]),
    league: z.string().trim().max(80).optional().or(z.literal("")),
    title: z.string().trim().min(8, "Title must be at least 8 characters").max(160),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    rules: z.string().trim().max(2000).optional().or(z.literal("")),
    teamA: z.string().trim().max(80).optional().or(z.literal("")),
    teamB: z.string().trim().max(80).optional().or(z.literal("")),
    outcomes: z.array(marketOutcomeSchema).min(2, "At least 2 outcomes required").max(8, "Maximum 8 outcomes"),
    imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
    minTrade: z.number().min(0.01).max(100_000),
    maxTrade: z.number().min(1).max(1_000_000),
    startTime: z.string().trim().min(1, "Select a start time"),
    endTime: z.string().trim().min(1, "Select an end time"),
    status: z.enum(["draft", "open", "closed"]).default("draft"),
    isFeatured: z.boolean().default(false),
    isTrending: z.boolean().default(false),
  })
  .refine((d) => new Date(d.endTime) > new Date(d.startTime), {
    message: "End time must be after the start time",
    path: ["endTime"],
  })
  .refine((d) => d.maxTrade >= d.minTrade, {
    message: "Maximum must be greater than the minimum",
    path: ["maxTrade"],
  })
  .refine((d) => {
    const sum = d.outcomes.reduce((acc, o) => acc + (o.odds ?? 0), 0);
    return !d.outcomes.every((o) => o.odds !== undefined) || Math.abs(sum - 1) < 0.01;
  }, {
    message: "Outcome odds must sum to approximately 1.00",
    path: ["outcomes"],
  });

export const resolveMarketSchema = z.object({
  marketId: z.string().uuid(),
  optionId: z.string().uuid(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const seedVolumeSchema = z.object({
  marketId: z.string().uuid(),
  seeds: z.array(z.object({
    optionId: z.string().uuid(),
    seedVolume: z.number().min(0).max(1_000_000),
  })).min(1),
});

// ------------------------------------------------------------ admin misc
export const reviewSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const approveWithdrawalSchema = z.object({
  requestId: z.string().uuid(),
  txHash: txHash.optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const userStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["active", "suspended", "banned"]),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
  until: z.string().trim().optional().or(z.literal("")),
});

// `set` accepts zero so an admin can empty a balance; add/remove cannot.
export const balanceAdjustSchema = z
  .object({
    userId: z.string().uuid(),
    mode: z.enum(["add", "remove", "set"]),
    amount: z.number().min(0, "Enter an amount of zero or more").max(1_000_000),
    isBonus: z.boolean().default(false),
    note: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .refine((d) => d.mode === "set" || d.amount > 0, {
    message: "Enter an amount greater than zero",
    path: ["amount"],
  });

export const siteSettingsSchema = z.object({
  siteName: z.string().trim().min(2).max(60),
  siteTagline: z.string().trim().max(120).optional().or(z.literal("")),
  supportEmail: z.string().trim().email().optional().or(z.literal("")),
  twitterUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  telegramUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  discordUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  tradeFeePercent: z.number().min(0).max(20),
  tradeFeeMin: z.number().min(0).max(1000),
  tradeFeeMax: z.number().min(0).max(1000),
  cancelFeeMin: z.number().min(0).max(1000),
  cancelFeeMax: z.number().min(0).max(1000),
  minDeposit: z.number().min(0).max(1_000_000),
  minWithdrawal: z.number().min(0).max(1_000_000),
  withdrawalFeePercent: z.number().min(0).max(20),
  welcomeBonus: z.number().min(0).max(10_000),
  depositBonusPercent: z.number().min(0).max(100),
  firstDepositBonusPercent: z.number().min(0).max(500),
  firstDepositBonusMax: z.number().min(0).max(1_000_000),
  bonusTurnoverMultiplier: z.number().min(0).max(100),
  referralCommissionPercent: z.number().min(0).max(50),
  referralSignupReward: z.number().min(0).max(100_000),
  kycRequiredForWithdrawal: z.boolean(),
  maintenanceMode: z.boolean(),
  registrationEnabled: z.boolean(),
  adsEnabled: z.boolean().default(false),
  adReward: z.number().min(0).max(100).default(0.05),
  adWatchSeconds: z.number().int().min(5).max(120).default(20),
  adDailyLimit: z.number().int().min(0).max(500).default(20),
  earnTasksEnabled: z.boolean().default(true),
  taskRewardIsBonus: z.boolean().default(true),
});

export const depositAddressSchema = z.object({
  network: networkEnum,
  asset: z.string().trim().min(2).max(10),
  address: evmAddress,
  label: z.string().trim().max(60).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const bannerSchema = z.object({
  title: z.string().trim().min(3, "Enter a banner title").max(120),
  subtitle: z.string().trim().max(240).optional().or(z.literal("")),
  imageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  linkUrl: z.string().trim().max(500).optional().or(z.literal("")),
  ctaText: z.string().trim().max(40).optional().or(z.literal("")),
  bgGradient: z.string().trim().max(160).optional().or(z.literal("")),
  position: z.number().int().min(0).max(999).default(0),
  bonusAmount: z.number().min(0).max(10_000).default(0),
  userLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  startsAt: z.string().trim().optional().or(z.literal("")),
  endsAt: z.string().trim().optional().or(z.literal("")),
});

export const campaignSchema = z
  .object({
    title: z.string().trim().min(3, "Enter a campaign title").max(120),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    metric: z.enum(["trading_volume", "referral_count", "referral_volume"]),
    startsAt: z.string().trim().min(1, "Set a start time"),
    endsAt: z.string().trim().min(1, "Set an end time"),
    isActive: z.boolean().default(true),
    prizeNote: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine((d) => new Date(d.endsAt) > new Date(d.startsAt), {
    message: "End must be after the start",
    path: ["endsAt"],
  });

export const partnerSchema = z.object({
  name: z.string().trim().min(2, "Enter the partner name").max(80),
  logoUrl: z.string().trim().min(1, "Provide a logo URL").max(500),
  websiteUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(120),
  message: z.string().trim().min(3, "Enter a message").max(1000),
  link: z.string().trim().max(300).optional().or(z.literal("")),
});

export const earnTaskSchema = z.object({
  type: z.enum([
    "twitter_follow",
    "twitter_retweet",
    "telegram_join",
    "discord_join",
    "youtube_subscribe",
    "instagram_follow",
    "facebook_follow",
    "custom",
  ]),
  title: z.string().trim().min(3, "Enter a task title").max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  instructions: z.string().trim().max(1000).optional().or(z.literal("")),
  targetUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  reward: z.number().min(0, "Reward must be positive").max(100),
  requiresProof: z.boolean().default(true),
  isRepeatable: z.boolean().default(false),
  cooldownHours: z.number().int().min(0).max(720).default(24),
  userLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
  isActive: z.boolean().default(true),
  position: z.number().int().min(0).max(999).default(0),
  startsAt: z.string().trim().optional().or(z.literal("")),
  endsAt: z.string().trim().optional().or(z.literal("")),
});

export const taskSubmissionSchema = z.object({
  taskId: z.string().uuid(),
  proofUrl: z.string().trim().max(500).optional().or(z.literal("")),
  proofNote: z.string().trim().max(500).optional().or(z.literal("")),
});

export const reviewTaskSchema = z.object({
  submissionId: z.string().uuid(),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export const adPlacementSchema = z.object({
  placement: z.enum(["header", "sidebar", "in_feed", "footer", "market_detail", "earn_page"]),
  provider: z.enum(["admob", "adsterra", "startio"]),
  format: z.enum(["banner", "native", "interstitial", "rewarded_video"]).default("banner"),
  unitId: z.string().trim().max(200).optional().or(z.literal("")),
  scriptUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  scriptKey: z.string().trim().max(200).optional().or(z.literal("")),
  isActive: z.boolean().default(false),
  width: z.number().int().min(1).max(2000).nullable().default(null),
  height: z.number().int().min(1).max(2000).nullable().default(null),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
export type WithdrawInput = z.infer<typeof withdrawSchema>;
export type KycInput = z.infer<typeof kycSchema>;
export type MarketInput = z.infer<typeof marketSchema>;
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
export type CampaignInput = z.infer<typeof campaignSchema>;
export type PartnerInput = z.infer<typeof partnerSchema>;
export type EarnTaskInput = z.infer<typeof earnTaskSchema>;
export type TaskSubmissionInput = z.infer<typeof taskSubmissionSchema>;
export type ReviewTaskInput = z.infer<typeof reviewTaskSchema>;
export type AdPlacementInput = z.infer<typeof adPlacementSchema>;
