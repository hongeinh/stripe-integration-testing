import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { userHandler } from "$lib/store/userStore.js";
import { adminDb } from "$lib/firebase-admin";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});

export async function POST({ request }: { request: Request }) {
    const { userId, type, subscriptionId } = await request.json();
    if (!userId) {
        return json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        const subscriptionListName = type === "user" ? "subscriptionUserList" : "subscriptionLocationList";
        const subscriptionDoc = await adminDb.collection(subscriptionListName).doc(userId).get();
        if (!subscriptionDoc.exists) {
            return json({ error: `${type} ${userId} does not have an active subscription` }, { status: 400 });
        }
        const currentSubscriptions = subscriptionDoc.data()?.subscriptions;
        
        for (const subscription of currentSubscriptions) {
            if (subscription.id !== subscriptionId) {
                continue;
            }
            if (subscription.status !== "active") {
                return json({ error: `Subscription is not active` }, { status: 400 });
            }
            console.log("Cancelling subscription", subscriptionId);
            await stripe.subscriptions.cancel(subscriptionId);
        }

        return json({ message: "Subscription canceled successfully", success: true }, { status: 200 });

    } catch (error) {
        console.error("Error canceling subscription:", error);
        return json({ error: (error as Error).message || "Failed to cancel subscription" }, { status: 500 });
    }
}