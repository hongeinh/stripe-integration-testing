import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/firebase-admin';

export async function GET({ url }) {
    const userId = url.searchParams.get('userId');
    const locationId = url.searchParams.get('locationId');
    const type = url.searchParams.get('type');

    if (type === 'user' && !userId) {
        return json({ error: "User ID is required for user subscriptions" }, { status: 400 });
    }

    if (type === 'location' && !locationId) {
        return json({ error: "Location ID is required for location subscriptions" }, { status: 400 });
    }

    try {
        let query;
        if (type === 'user') {
            query = adminDb.collection("subscriptionUserList")
                .where("userId", "==", userId)
                .orderBy("createdAt", "desc");
        } else {
            query = adminDb.collection("subscriptionLocationList")
                .where("locationId", "==", locationId)
                .orderBy("createdAt", "desc");
        }

        const snapshot = await query.get();
        const items = snapshot.docs.map(doc => doc.data());
        return json(items);
    } catch (error) {
        console.error("Error fetching subscription list:", error);
        return json({ error: "Failed to fetch subscription list" }, { status: 500 });
    }
} 