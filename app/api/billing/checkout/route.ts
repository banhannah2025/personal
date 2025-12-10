import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getStripeClient } from "@/lib/stripe";
import { getPriceIdForTier, isBillableTier } from "@/lib/billing";
import { type SubscriptionTierId } from "@/lib/subscription";

type CheckoutRequest = {
  tier?: SubscriptionTierId;
  origin?: string;
  successUrl?: string;
  cancelUrl?: string;
};

const DEFAULT_SUCCESS_PATH = "/app?checkout=success";
const DEFAULT_CANCEL_PATH = "/app?checkout=cancelled";

function parseUrlCandidate(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function resolveBaseUrl(request: Request, preferredOrigin?: string | null) {
  const candidate =
    parseUrlCandidate(preferredOrigin) ??
    parseUrlCandidate(request.headers.get("origin")) ??
    (() => {
      const referer = request.headers.get("referer");
      if (!referer) return null;
      try {
        const url = new URL(referer);
        url.pathname = "";
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/$/, "");
      } catch {
        return null;
      }
    })();

  if (candidate) {
    return candidate;
  }

  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    body = {};
  }

  const requestedTier = body.tier;
  if (!requestedTier || !isBillableTier(requestedTier)) {
    return NextResponse.json({ error: "A paid tier is required." }, { status: 400 });
  }

  const priceId = getPriceIdForTier(requestedTier);
  if (!priceId) {
    return NextResponse.json(
      {
        error: `Stripe price ID for the ${requestedTier} plan is missing. Set ${
          requestedTier === "plus" ? "STRIPE_PRICE_ID_PLUS" : "STRIPE_PRICE_ID_PRO"
        }.`,
      },
      { status: 500 }
    );
  }

  const baseUrl = resolveBaseUrl(request, body.origin);
  const successUrl = parseUrlCandidate(body.successUrl) ?? `${baseUrl}${DEFAULT_SUCCESS_PATH}`;
  const cancelUrl = parseUrlCandidate(body.cancelUrl) ?? `${baseUrl}${DEFAULT_CANCEL_PATH}`;

  const email =
    user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null;
  if (!email) {
    return NextResponse.json({ error: "Account email is required for checkout." }, { status: 400 });
  }

  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  const privateMetadata = user.privateMetadata as Record<string, unknown> | undefined;

  const stripeCustomerId =
    (metadata?.stripeCustomerId as string | undefined) ??
    (privateMetadata?.stripeCustomerId as string | undefined) ??
    null;

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      allow_promotion_codes: true,
      client_reference_id: user.id,
      customer: stripeCustomerId ?? undefined,
      customer_email: stripeCustomerId ? undefined : email,
      metadata: {
        clerkUserId: user.id,
        tier: requestedTier,
      },
      subscription_data: {
        metadata: {
          clerkUserId: user.id,
          tier: requestedTier,
        },
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session error", error);
    return NextResponse.json(
      { error: "Unable to create checkout session. Please try again." },
      { status: 500 }
    );
  }
}

