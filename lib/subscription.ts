type PublicMetadata = Record<string, unknown> | null | undefined;

export type SubscriptionTierId = "free" | "plus" | "pro";

const tierKeywordMap: Record<string, SubscriptionTierId> = {
  free: "free",
  resident: "free",
  preview: "free",
  plus: "plus",
  studio: "plus",
  pro: "pro",
  lab: "pro",
  laboratory: "pro",
  admin: "pro",
  premium: "pro",
};

const tierFlagChecks: Array<{ key: string; tier: SubscriptionTierId }> = [
  { key: "proAccess", tier: "pro" },
  { key: "pro_enabled", tier: "pro" },
  { key: "isPro", tier: "pro" },
  { key: "labAccess", tier: "pro" },
  { key: "lab_enabled", tier: "pro" },
  { key: "isLab", tier: "pro" },
  { key: "plusAccess", tier: "plus" },
  { key: "plus_enabled", tier: "plus" },
  { key: "isPlus", tier: "plus" },
  { key: "studioAccess", tier: "plus" },
  { key: "studio_enabled", tier: "plus" },
  { key: "isStudio", tier: "plus" },
];

function normalizeTier(value: string | null | undefined): SubscriptionTierId | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  for (const keyword of Object.keys(tierKeywordMap)) {
    if (normalized.includes(keyword)) {
      return tierKeywordMap[keyword];
    }
  }
  return null;
}

function extractTierFromMetadata(metadata: PublicMetadata): SubscriptionTierId | null {
  if (!metadata) return null;
  if (typeof metadata !== "object") return null;

  for (const { key, tier } of tierFlagChecks) {
    if (metadata[key as keyof typeof metadata] === true) {
      return tier;
    }
  }

  const candidateKeys = [
    "tier",
    "plan",
    "subscription",
    "subscriptionTier",
    "subscription_plan",
    "membership",
    "accessLevel",
    "access_level",
  ];

  for (const key of candidateKeys) {
    const rawValue = metadata[key as keyof typeof metadata];
    if (typeof rawValue === "string") {
      const tier = normalizeTier(rawValue);
      if (tier) {
        return tier;
      }
    }
  }

  return null;
}

export function deriveTierFromMetadata(
  metadata: PublicMetadata,
  options?: { isAdmin?: boolean }
): SubscriptionTierId {
  if (options?.isAdmin) {
    return "pro";
  }
  return extractTierFromMetadata(metadata) ?? "free";
}
