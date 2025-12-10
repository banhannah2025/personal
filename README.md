This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Stripe Billing Setup

1. Create Stripe Products and recurring Prices for the Plus and Pro memberships, then copy the Price IDs into `.env.local` (and production secrets) as `STRIPE_PRICE_ID_PLUS` / `STRIPE_PRICE_ID_PRO`. Your existing `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` values stay the same.
2. Expose a webhook endpoint in Stripe that points to `/api/billing/webhook`. In local dev you can run `stripe login` followed by `stripe listen --forward-to localhost:3000/api/billing/webhook` which will print a `whsec_...` signing secret—add that to `.env.local` as `STRIPE_WEBHOOK_SECRET`.
3. Make sure the webhook is subscribed to at least `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.
4. When Stripe calls the webhook, the app verifies the signature, looks at the associated Stripe customer/subscription, and syncs the user’s Clerk metadata (`stripeCustomerId`, `stripeSubscriptionId`, and their current tier). This is what unlocks the correct tools in the dashboard after checkout and downgrades a user if a subscription is canceled.
