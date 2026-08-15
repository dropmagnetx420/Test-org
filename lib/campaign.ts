import { CAMPAIGN_METRICS } from "@/lib/constants";
import { formatCurrency, toNumber } from "@/lib/utils";
import type { CampaignMetric } from "@/types/database";

const METRIC = new Map(CAMPAIGN_METRICS.map((m) => [m.value, m] as const));

export function metricLabel(metric: CampaignMetric) {
  return METRIC.get(metric)?.label ?? metric;
}

export function metricBlurb(metric: CampaignMetric) {
  return METRIC.get(metric)?.blurb ?? "";
}

/** A trading/referral-volume score is a USDG amount; a referral count is a plain
 *  integer. The `unit` on each metric decides which. */
export function formatScore(metric: CampaignMetric, score: number | string) {
  if (METRIC.get(metric)?.unit === "currency") return `${formatCurrency(score)} USDG`;
  return Math.round(toNumber(score)).toLocaleString();
}
