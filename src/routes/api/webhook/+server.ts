import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { userHandler } from "$lib/store/userStore.js";

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
        console.error(`Webhook Error: ${(err as Error).message}`);
        return new Response(`Webhook Error: ${err}`, { status: 400 });
    }

    console.log('Received event:', event.type);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription as string;
        const appliedPromoCode = session.total_details?.breakdown?.discounts?.[0]?.discount?.promotion_code || null;

        if (!userId || !subscriptionId) {
            console.warn('Missing userId or subscriptionId:', { userId, subscriptionId });
            return new Response('Invalid session data', { status: 400 });
        }
        try {
            // Get subscription detail
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            await userHandler.updateUser(userId, {
                subscriptionId: subscriptionId,
                currentPeriodStart: subscription.current_period_start,
                currentPeriodEnd: subscription.current_period_end,
                status: "active",
                promoCode: appliedPromoCode as string,
                updatedAt: new Date().toISOString(),
            });

            console.log('User document updated successfully:', userId);
        } catch (error) {
            console.error('Error updating user document:', error);
            return new Response(`Database error: ${(error as Error).message}`, { status: 500 })
        }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const userId = await userHandler.getUserWithSubscription(subscriptionId);

        if (!userId) {
            console.warn('User not found for subscription:', subscriptionId);
            return new Response('User not found', { status: 404 });
        }

        let status = "active";
        if (event.type === 'customer.subscription.deleted') {
            status = "canceled"
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
            status = "expired"
        }

        try {
            await userHandler.updateUser(userId, {
                status: status as "active" | "canceled" | "expired" | "inactive",
                updatedAt: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error updating user document:', error);
            return new Response(`Database error: ${(error as Error).message}`, { status: 500 })
        }
    } else {
        console.warn('Unhandled event type:', event.type);
    }

    return json({ received: true });
}