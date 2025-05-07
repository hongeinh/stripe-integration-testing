import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { userHandler } from "$lib/store/userStore.js";
import { adminDb } from "$lib/firebase-admin";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});

export async function POST({ request }: { request: Request }) {
    const { userId } = await request.json();
    if (!userId) {
        return json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        const subscriptionDoc = await adminDb.collection("users").doc(userId).collection("subscriptions").doc(userId).get();
        if (!subscriptionDoc.exists) {
            return json({ error: `User ${userId} does not have an active subscription` }, { status: 400 });
        }
    
        const subscriptionId = subscriptionDoc.data()?.subscriptionId;
        if (!subscriptionId) {
            return json({ error: `User ${userId} does not have an active subscription` }, { status: 400 });
        }

        await stripe.subscriptions.cancel(subscriptionId);
        await userHandler.updateUserSubscription(userId, {
            status: "canceled",
        });

        return json({ message: "Subscription canceled successfully", success: true }, { status: 200 });

    } catch (error) {
        console.error("Error canceling subscription:", error);
        return json({ error: (error as Error).message || "Failed to cancel subscription" }, { status: 500 });
    }
}