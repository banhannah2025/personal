import { NextResponse } from "next/server";
import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import { getStripeClient } from "@/lib/stripe";
import { getTierFromPriceId } from "@/lib/billing";
import type { SubscriptionTierId } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ClerkClientType = Awaited<ReturnType<typeof clerkClient>>;
type UpdateUserPayload = Parameters<ClerkClientType["users"]["updateUser"]>[1];

type BillingMetadataUpdate = {
  userId: string;
  tier?: SubscriptionTierId;
  customerId?: string | null;
  subscriptionId?: string | null;
  subscriptionStatus?: Stripe.Subscription.Status;
};

const ACTIVE_STATUSES: Array<Stripe.Subscription.Status> = ["active", "trialing", "past_due"];

function normalizeStripeId(raw: string | Stripe.Customer | Stripe.Subscription | null | undefined) {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  return raw.id;
}

function getTierFromSubscription(subscription: Stripe.Subscription): SubscriptionTierId | null {
  for (const item of subscription.items.data) {
    const priceId = typeof item.price === "string" ? item.price : item.price?.id;
    const tier = getTierFromPriceId(priceId);
    if (tier) {
      return tier;
    }
  }
  return null;
}

async function updateUserBillingMetadata(update: BillingMetadataUpdate) {
  const publicMetadata: Record<string, unknown> = {};
  const privateMetadata: Record<string, unknown> = {};

  if (typeof update.customerId !== "undefined") {
    publicMetadata.stripeCustomerId = update.customerId;
    privateMetadata.stripeCustomerId = update.customerId;
  }

  if (typeof update.subscriptionId !== "undefined") {
    publicMetadata.stripeSubscriptionId = update.subscriptionId;
    privateMetadata.stripeSubscriptionId = update.subscriptionId;
  }

  if (typeof update.subscriptionStatus !== "undefined") {
    publicMetadata.stripeSubscriptionStatus = update.subscriptionStatus;
  }

  if (update.tier) {
    publicMetadata.tier = update.tier;
    publicMetadata.plan = update.tier;
    publicMetadata.subscriptionTier = update.tier;
  }

  const payload: UpdateUserPayload = {};
  if (Object.keys(publicMetadata).length > 0) {
    payload.publicMetadata = publicMetadata;
  }
  if (Object.keys(privateMetadata).length > 0) {
    payload.privateMetadata = privateMetadata;
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const client = await clerkClient();
  await client.users.updateUser(update.userId, payload);
}

async function findUserIdByEmail(email?: string | null) {
  if (!email) return null;
  const client = await clerkClient();
  const list = await client.users.getUserList({
    emailAddress: [email],
    limit: 1,
  });
  return list.data[0]?.id ?? null;
}

async function handleCheckoutSession(
  session: Stripe.Checkout.Session,
  stripe: Stripe
) {
  const clerkUserId =
    (session.metadata?.clerkUserId as string | undefined) ??
    (await findUserIdByEmail(session.customer_details?.email ?? session.customer_email ?? null));
  if (!clerkUserId) {
    console.warn("Stripe checkout webhook missing Clerk user mapping", session.id);
    return;
  }

  const customerId = normalizeStripeId(session.customer);
  const subscriptionId = normalizeStripeId(session.subscription);

  let tierFromMetadata: SubscriptionTierId | null = null;
  const metadataTier = session.metadata?.tier;
  if (metadataTier === "plus" || metadataTier === "pro") {
    tierFromMetadata = metadataTier;
  }

  let tierFromSubscription: SubscriptionTierId | null = null;
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });
      tierFromSubscription = getTierFromSubscription(subscription);
    } catch (error) {
      console.error("Unable to fetch subscription for checkout session", subscriptionId, error);
    }
  }

  const tier = tierFromMetadata ?? tierFromSubscription ?? "free";
  await updateUserBillingMetadata({
    userId: clerkUserId,
    tier,
    customerId,
    subscriptionId,
    subscriptionStatus: tier === "free" ? undefined : "active",
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription) {
  const clerkUserId = subscription.metadata?.clerkUserId as string | undefined;
  if (!clerkUserId) {
    console.warn("Stripe subscription webhook missing Clerk user mapping", subscription.id);
    return;
  }

  const customerId = normalizeStripeId(subscription.customer);
  const tierFromItems = getTierFromSubscription(subscription);
  const stripeStatus = subscription.status;
  const tier: SubscriptionTierId =
    tierFromItems && ACTIVE_STATUSES.includes(stripeStatus) ? tierFromItems : "free";

  await updateUserBillingMetadata({
    userId: clerkUserId,
    tier,
    customerId,
    subscriptionId: subscription.id,
    subscriptionStatus: stripeStatus,
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook secret is not configured." },
      { status: 500 }
    );
  }

  const body = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session, stripe);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handler error", error);
    return NextResponse.json({ error: "Webhook handler error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
