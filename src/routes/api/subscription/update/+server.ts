import { json } from "@sveltejs/kit";
import { adminDb } from "$lib/firebase-admin";
import type { SubscriptionUserItem, SubscriptionHistory } from "$lib/type";
import { v4 as uuidv4 } from "uuid";

/**
 * Update UserSubscription data in Firestore
 * @param userId
 * @param updatedData
 * @returns 
 */
export async function POST({ request }: { request: Request }) {
    const { userId, updatedData } = await request.json();

    if (!userId) {
        return json({ error: "User ID is required" }, { status: 400 });
    }

    try {
        // subscriptionRef is used in case user renew current subscription
        const subscriptionRef = adminDb.collection("users").doc(userId).collection("subscriptions").doc(userId);
        const subscriptionDoc = await subscriptionRef.get();
        let subscriptionData = (subscriptionDoc.exists ? subscriptionDoc.data() : { id: userId, userId }) as SubscriptionUserItem;

        // Prepare history entry if subscription changes
        let historyEntry: SubscriptionHistory | null = null;

        if (updatedData.subscriptionId && updatedData.subscriptionId !== subscriptionData.subscriptionId) {
            historyEntry = {
                id: uuidv4(),
                userId,
                subscriptionId: updatedData.subscriptionId,
                priceId: updatedData.priceId || subscriptionData.priceId || "",
                priceAmount: updatedData.priceAmount || subscriptionData.amountSubtotal || 0,
                currency: updatedData.currency || subscriptionData.currency || "usd",
                promoCode: updatedData?.promoCode,
                paid: updatedData.status === "active",
                createdAt: new Date().toISOString(),
            };
        }

        if (updatedData.subscriptionId) subscriptionData.subscriptionId = updatedData.subscriptionId;
        if (updatedData.subscriptionName) subscriptionData.subscriptionName = updatedData.subscriptionName;
        if (updatedData.priceId) subscriptionData.priceId = updatedData.priceId;
        if (updatedData.priceAmount !== undefined) subscriptionData.amountSubtotal = updatedData.priceAmount;
        if (updatedData.currency) subscriptionData.currency = updatedData.currency;
        if (updatedData.status) {
            subscriptionData.status = updatedData.status;

            if (["canceled", "inactive"].includes(updatedData.status)) {
                subscriptionData.currentPeriodStart = "";
                subscriptionData.currentPeriodEnd = "";
            }
            else if (updatedData.status === "active") {
                subscriptionData.currentPeriodEnd = updatedData.currentPeriodEnd
                    ? (typeof updatedData.currentPeriodEnd === "number" ? new Date(updatedData.currentPeriodEnd * 1000).toISOString : updatedData.currentPeriodEnd)
                    : subscriptionData.currentPeriodEnd;
                subscriptionData.currentPeriodStart = updatedData.currentPeriodStart
                    ? (typeof updatedData.currentPeriodStart === "number" ? new Date(updatedData.currentPeriodStart * 1000).toISOString : updatedData.currentPeriodStart)
                    : subscriptionData.currentPeriodStart;
            }
        }

        if (updatedData.promoCode !== undefined) subscriptionData.discounts = updatedData.promoCode;

        subscriptionData.updatedAt = new Date().toISOString();

        if (subscriptionDoc.exists) {
            await subscriptionRef.update(subscriptionData);
        } else {
            await subscriptionRef.set(subscriptionData);
        }

        if (historyEntry) {
            const historyRef = adminDb.collection("users").doc(userId).collection("subscriptionHistory").doc(historyEntry.id);
            await historyRef.set(historyEntry);
        }

        return json(subscriptionData)
    } catch (error) {
        console.error("Error updating user subscription:", error);
        return json({ error: (error as Error).message || "Failed to update user subscription" }, { status: 500 });
    }

}