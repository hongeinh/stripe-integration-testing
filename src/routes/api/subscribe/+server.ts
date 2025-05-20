import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { P } from "flowbite-svelte";


const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});

export async function POST({ request, url }) {


    const { priceId, userId, promoCode, locationId } = await request.json();
    if (!priceId || !userId) {
        return json({ error: "Price ID and User ID are required" }, { status: 400 });
    }
    console.log("price", priceId, "userId", userId, "promoCode", promoCode, "locationId", locationId)

    let discounts: { promotion_code: string }[] = []
    if (promoCode) {
        try {
            const promotionCodes = await stripe.promotionCodes.list({
                code: promoCode,
                active: true,
                limit: 1
            });
    
            if (promotionCodes.data.length === 0) {
                return json({ error: "Invalid or inactive promo code" }, { status: 400 });
            }
    
            discounts = [{ promotion_code: promotionCodes.data[0].id }];
        } catch (error) {
            console.error("Error fetching promotion codes:", error);
            return json({ error: (error as Error).message  || "Error fetching promotion codes" }, { status: 500 });
        }
    }
    console.log({ discounts })
    
    try {
        const baseUrl = url.origin;
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            mode: "subscription",
            line_items: [{ price: priceId, quantity: 1 }],
            client_reference_id: userId,
            metadata: {
                userId, priceId, locationId
            },
            discounts,
            success_url: `${baseUrl}/user/${userId}?status=success&priceId=${priceId}`,
            cancel_url: `${baseUrl}/user/${userId}?status=cancel&priceId=${priceId}`,
        });
    
        return json({ url: session.url });
    } catch (error) {
        console.error("Error creating checkout session:", error);
        return json({ error: (error as Error).message || "Error creating checkout session" }, { status: 500 });
    }
}