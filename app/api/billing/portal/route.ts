import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { getStripeClient } from "@/lib/stripe";

type PortalRequest = {
  origin?: string;
  returnUrl?: string;
};

const DEFAULT_RETURN_PATH = "/app?checkout=manage";

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

  let body: PortalRequest;
  try {
    body = (await request.json()) as PortalRequest;
  } catch {
    body = {};
  }

  const metadata = user.publicMetadata as Record<string, unknown> | undefined;
  const privateMetadata = user.privateMetadata as Record<string, unknown> | undefined;

  const stripeCustomerId =
    (metadata?.stripeCustomerId as string | undefined) ??
    (privateMetadata?.stripeCustomerId as string | undefined) ??
    null;

  if (!stripeCustomerId) {
    return NextResponse.json(
      {
        error:
          "No Stripe customer is linked to this account yet. Complete a checkout session before opening the billing portal.",
      },
      { status: 400 }
    );
  }

  const baseUrl = resolveBaseUrl(request, body.origin);
  const returnUrl = parseUrlCandidate(body.returnUrl) ?? `${baseUrl}${DEFAULT_RETURN_PATH}`;

  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal session error", error);
    return NextResponse.json(
      { error: "Unable to open the billing portal right now. Please try again." },
      { status: 500 }
    );
  }
}

