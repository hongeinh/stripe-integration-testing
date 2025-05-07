import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/firebase-admin.js';

export async function GET({ request }) {
    const { subscriptionId } = await request.json();
    if (!subscriptionId) {
        return json({ error: "Subscription ID is required" }, { status: 400 });
    }

    try {
        const userSnapshot = await adminDb.collectionGroup('subscriptions')
            .where('subscriptionId', '==', subscriptionId)
            .limit(1)
            .get();
        if (userSnapshot.empty) {
            return json(null,  { status: 200 });;
        }

        return json(userSnapshot.docs[0].id, { status: 200 });
    } catch (error) {
        console.error("Error getting user:", error);
        return json({ error: (error as Error).message || "Internal server error" }, { status: 500 });
    }
}