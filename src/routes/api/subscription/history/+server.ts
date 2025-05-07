import  { json } from '@sveltejs/kit';
import { adminDb } from '$lib/firebase-admin';

export async function GET({ request, url }) {
    const userId = url.searchParams.get('userId');
    if (!userId) {
        return json({ error: "User ID is required" }, { status: 400 });
    }
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const snapshot = await adminDb
        .collection('users')
        .doc(userId)
        .collection('subscriptionHistory')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
    const history = snapshot.docs.map(doc => doc.data());
    return json(history);
}