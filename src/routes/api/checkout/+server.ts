import Stripe from "stripe";
import { json } from "@sveltejs/kit";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});

export async function POST({ request }) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
        {
            price_data: {
                currency: "usd",
                product_data: {
                    name: "Test product"
                },
                unit_amount: 2000
            },
            quantity: 1
        }
    ],

    success_url: "http://localhost:5173/success",
    cancel_url: "http://localhost:5173/cancel"
  });

  return json({ url: session.url });
}