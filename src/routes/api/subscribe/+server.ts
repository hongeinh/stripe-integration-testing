import Stripe from "stripe";
import { json } from "@sveltejs/kit";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});

export async function POST({ request }: { request: Request }) {

  const { priceId, userId } = await request.json();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: userId,
    metadata: {
      userId,
    },
    success_url: `http://localhost:5173/user/${userId}?status=success&priceId=${priceId}`,
    cancel_url: `http://localhost:5173/user/${userId}?status=cancel&priceId=${priceId}`,
  });

  return json({ url: session.url });
}