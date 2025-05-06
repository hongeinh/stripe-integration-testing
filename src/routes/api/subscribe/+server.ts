//@ts-nocheck
import Stripe from "stripe";
import { json } from "@sveltejs/kit";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});

export async function POST({ request }: { request: Request }) {

  // console.log(await request.json())
  let discounts = []
  const { priceId, userId, promoCode } = await request.json();
  console.log(priceId, userId, promoCode)

  if (promoCode) {
    const promotionCodes = await stripe.promotionCodes.list({
      code: promoCode,
      active: true,
      limit: 1
    });

    if (promotionCodes.data.length === 0) {
      return json({ error: "Invalid or inactive promo code" }, { status: 400 });
    }

    discounts = [{ promotion_code: promotionCodes.data[0].id }];
  }
  console.log({ discounts })
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    metadata: {
      userId,
    },
    discounts,
    success_url: `http://localhost:5173/user/${userId}?status=success&priceId=${priceId}`,
    cancel_url: `http://localhost:5173/user/${userId}?status=cancel&priceId=${priceId}`,
  });

  return json({ url: session.url });
}