import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { adminDb } from "$lib/firebase-admin";
import { db } from "$lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});
const endpointSecret = import.meta.env.VITE_STRIPE_WEBHOOK_SECRET;

export async function POST({ request }) {
    const sig = request.headers.get('stripe-signature');
    const body = await request.text();

    let event;
    try {
        event = stripe.webhooks.constructEvent(body, sig!, endpointSecret);
    } catch (err) {
        return new Response(`Webhook Error: ${err}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription;
        console.log("Successfully checkout");
        if (userId && subscriptionId) {
            await adminDb.collection('users').doc(userId).update({
                subscriptionId,
                status: 'active',
                updated: new Date().toISOString()
            });
        }
    } else {
        console.log("Unhandled event type: ", event.type);
    }

    return json({ received: true });
}