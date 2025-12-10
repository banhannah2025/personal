import { type SubscriptionTierId } from "./subscription";

export type BillableTierId = Exclude<SubscriptionTierId, "free">;

const tierPriceEnvKeyMap: Record<BillableTierId, string> = {
  plus: "STRIPE_PRICE_ID_PLUS",
  pro: "STRIPE_PRICE_ID_PRO",
};

export function isBillableTier(tier: SubscriptionTierId): tier is BillableTierId {
  return tier !== "free";
}

export function getPriceIdForTier(tier: SubscriptionTierId) {
  if (!isBillableTier(tier)) {
    return null;
  }
  const envVar = tierPriceEnvKeyMap[tier];
  const priceId = process.env[envVar];
  return typeof priceId === "string" && priceId.length > 0 ? priceId : null;
}

export function getTierFromPriceId(priceId?: string | null): SubscriptionTierId | null {
  if (!priceId) {
    return null;
  }
  for (const [tier, envKey] of Object.entries(tierPriceEnvKeyMap) as Array<
    [BillableTierId, string]
  >) {
    const configuredPrice = process.env[envKey];
    if (configuredPrice && configuredPrice === priceId) {
      return tier;
    }
  }
  return null;
}

