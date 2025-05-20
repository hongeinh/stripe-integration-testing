//@ts-nocheck
import { json } from "@sveltejs/kit";
import { userHandler } from "$lib/store/userStore.js";


export async function POST({ request }) {
    const body = await request.text();
    const { userId, subscriptionId, appliedPromoCode } = JSON.parse(body);

    try {

        await userHandler.updateUserSubscription(userId, {
            subscriptionId: subscriptionId,
            status: "inactive",
            discounts: appliedPromoCode as string,
            updatedAt: new Date().toISOString(),
        });

        console.log('User document updated successfully:', userId);
    } catch (error) {
        console.error('Error updating user document:', error);
        return new Response(`Database error: ${(error as Error).message}`, { status: 500 })
    }

    return json({ received: true });
}