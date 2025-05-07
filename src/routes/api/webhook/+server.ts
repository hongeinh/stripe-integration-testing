import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { adminDb } from "$lib/firebase-admin.js";
import type { UserSubscription, SubscriptionHistory } from "$lib/type.js";
import { v4 as uuidv4 } from "uuid";


const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});
const endpointSecret = import.meta.env.VITE_STRIPE_WEBHOOK_SECRET;

export async function POST({ request }) {
    const sig = request.headers.get('stripe-signature');
    const body = await request.text();

    if (!sig) {
        return new Response('Webhook error: Missing Stripe signature header', { status: 400 });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Error: ${(err as Error).message}`);
        return new Response(`Webhook Error: ${err}`, { status: 400 });
    }


    if (event.type === 'checkout.session.completed') {
        console.log('Received event:', event.type);
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const subscriptionId = session.subscription as string;
        const appliedPromoCode = session?.discounts?.[0].promotion_code || null;

        console.log({ session, userId, subscriptionId, appliedPromoCode });
        if (!userId || !subscriptionId) {
            console.warn('Missing userId, subscriptionId', { userId, subscriptionId });
            return new Response('Invalid session data', { status: 400 });
        }
        try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price", "items.data.plan.product"] });
            const item = subscription.items.data[0];
            const product = item.plan?.product;
            const priceId = item.price.id;
            const price = item.price;
            console.log({ subscription, price, product: product});
            console.log("Subscription details:", item);

            let subscriptionName = product?.name || "Subscription";
            const currentPeriodStart = subscription.items.data[0].current_period_start;
            const currentPeriodEnd = subscription.items.data[0].current_period_end;
            await updateUserSubscription(userId, {
                subscriptionId,
                subscriptionName,
                priceId,
                priceAmount: price.unit_amount || 0,
                currency: price.currency || "usd",
                currentPeriodStart: convertNumberTimeToISO(currentPeriodStart),
                currentPeriodEnd: convertNumberTimeToISO(currentPeriodEnd),
                status: "active",
                promoCode: appliedPromoCode as string,
            });

            console.log(`Update user ${userId} subscription ${subscriptionId} successfully:`);
        } catch (error) {
            console.error('Error updating user document:', error);
            return new Response(`Database error: ${(error as Error).message}`, { status: 500 })
        }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const userId = await getUserWithSubscription(subscriptionId);

        if (!userId) {
            console.warn('User not found for subscription:', subscriptionId);
            return new Response('User not found', { status: 404 });
        }

        let status: "active" | "canceled" | "inactive" | "expired" = "active";
        if (event.type === 'customer.subscription.deleted') {
            status = "canceled"
        } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
            status = "expired"
        }

        try {
            await updateUserSubscription(userId, { status });
        } catch (error) {
            console.error('Error updating user document:', error);
            return new Response(`Database error: ${(error as Error).message}`, { status: 500 })
        }
    }

    return json({ received: true });
}


async function updateUserSubscription(userId: string, updatedData: Partial<UserSubscription>) {
    if (!userId) {
        return json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        // subscriptionRef is used in case user renew current subscription
        const subscriptionRef = adminDb.collection("users").doc(userId).collection("subscriptions").doc(userId);
        const subscriptionDoc = await subscriptionRef.get();
        let subscriptionData: UserSubscription = (subscriptionDoc.exists ? subscriptionDoc.data() : { id: userId, userId }) as UserSubscription;

        // Prepare history entry if subscription changes
        let historyEntry: SubscriptionHistory | null = null;

        if (updatedData.subscriptionId && updatedData.subscriptionId !== subscriptionData.subscriptionId) {
            historyEntry = {
                id: uuidv4(),
                userId,
                subscriptionId: updatedData.subscriptionId,
                subscriptionName: updatedData.subscriptionName || subscriptionData.subscriptionName || "",
                priceId: updatedData.priceId || subscriptionData.priceId || "",
                priceAmount: updatedData.priceAmount || subscriptionData.priceAmount || 0,
                currency: updatedData.currency || subscriptionData.currency || "usd",
                promoCode: updatedData?.promoCode,
                periodStart: updatedData.currentPeriodStart || subscriptionData.currentPeriodStart || "",
                periodEnd: updatedData.currentPeriodEnd || subscriptionData.currentPeriodEnd || "",
                paid: updatedData.status === "active",
                createdAt: new Date().toISOString(),
            };
        }

        if (updatedData.subscriptionId) subscriptionData.subscriptionId = updatedData.subscriptionId;
        if (updatedData.subscriptionName) subscriptionData.subscriptionName = updatedData.subscriptionName;
        if (updatedData.priceId) subscriptionData.priceId = updatedData.priceId;
        if (updatedData.priceAmount !== undefined) subscriptionData.priceAmount = updatedData.priceAmount;
        if (updatedData.currency) subscriptionData.currency = updatedData.currency;
        if (updatedData.status) {
            subscriptionData.status = updatedData.status;

            if (["canceled", "inactive"].includes(updatedData.status)) {
                subscriptionData.subscriptionId = "";
                subscriptionData.currentPeriodStart = "";
                subscriptionData.currentPeriodEnd = "";
                subscriptionData.promoCode = "";
            } else if (updatedData.status === "active") {
                subscriptionData.currentPeriodEnd = convertNumberTimeToISO(updatedData.currentPeriodEnd || subscriptionData.currentPeriodEnd);
                subscriptionData.currentPeriodStart = convertNumberTimeToISO(updatedData.currentPeriodStart || subscriptionData.currentPeriodStart);
            }
        }

        if (updatedData.promoCode !== undefined) subscriptionData.promoCode = updatedData.promoCode;

        subscriptionData.updatedAt = new Date().toISOString();

        if (subscriptionDoc.exists) {
            await subscriptionRef.update(subscriptionData);
        } else {
            await subscriptionRef.set({
                ...subscriptionData,
                createdAt: new Date().toISOString(),
            });
        }

        if (historyEntry) {
            const historyRef = adminDb.collection("users").doc(userId).collection("subscriptionHistory").doc(historyEntry.id);
            await historyRef.set(historyEntry);
        }


        return subscriptionData;
    } catch (error) {
        console.error("Error updating user subscription:", error);
        throw error;
    }
}

async function getUserWithSubscription(subscriptionId: string) {
    if (!subscriptionId) {
        throw new Error("Subscription ID is required");
    }

    try {
        const userSnapshot = await adminDb.collectionGroup("subscriptions").where("subscriptionId", "==", subscriptionId).limit(1).get();
        return userSnapshot.empty ? null : userSnapshot.docs[0].data().userId;
    } catch (error) {
        console.error("Error fetching user with subscription:", error);
        return null;
    }
}

function convertNumberTimeToISO(time: number | string) {
    if (typeof time === "number") {
        return new Date(time * 1000).toISOString();
    }
    return time || "";
}

function calculatePeriodEnd(startDate: number, interval?: string, intervalCount?: number): number {
    const start = new Date(startDate * 1000);
    let end: Date;

    if (interval === "month") {
        end = new Date(start);
        end.setMonth(start.getMonth() + (intervalCount || 1));
    } else if (interval === "year") {
        end = new Date(start);
        end.setFullYear(start.getFullYear() + (intervalCount || 1));
    } else if (interval === "week") {
        end = new Date(start);
        end.setDate(start.getDate() + (intervalCount || 1) * 7);
    } else if (interval === "day") {
        end = new Date(start);
        end.setDate(start.getDate() + (intervalCount || 1));
    } else {
        // Default to 1 month if interval is unknown
        end = new Date(start);
        end.setMonth(start.getMonth() + 1);
    }

    return Math.floor(end.getTime() / 1000);
}