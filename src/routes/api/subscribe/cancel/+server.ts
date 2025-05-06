import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { userHandler } from "$lib/store/userStore.js";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});

export async function POST({ request }) {
    const { userId } = await request.json();
    if (!userId) {
        return json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        const user = await userHandler.getUser(userId);
        if (!user) {
            return json({ error: "User not found" }, { status: 404 });
        }

        const subscriptionId = user.subscriptionId;
        if (!subscriptionId) {
            return json({ error: "User does not have an active subscription" }, { status: 400 });
        }

        await stripe.subscriptions.cancel(subscriptionId);
        await userHandler.updateUser(userId, {
            subscriptionId: "",
            status: "canceled",
        });

        return json({ message: "Subscription canceled successfully" }, { status: 200 });

    } catch (error) {
        console.error("Error canceling subscription:", error);
        return json({ error: (error as Error).message || "Failed to cancel subscription" }, { status: 500 });
    }
}