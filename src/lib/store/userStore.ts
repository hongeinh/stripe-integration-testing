import { writable } from "svelte/store";
import { db } from "$lib/firebase";
import type { SubscriptionHistory, UserData, UserSubscription } from "$lib/type";
import { collection, doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";

export const userStore = writable<{
    isLoading: boolean;
    currentUser: UserData | null;
    subscription: UserSubscription | null;
    subscriptionHistory: SubscriptionHistory[] | null;
}>({
    isLoading: true,
    currentUser: null,
    subscription: null,
    subscriptionHistory: null,
});

export const userHandler = {
    getUser: async (userId: string) => {
        if (!userId) {
            throw new Error("User ID is required");
        }

        userStore.update((store) => ({ ...store, isLoading: true }));

        try {
            // Fetch userData from Firestore
            const userRef = doc(db, "users", userId);
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists()) {
                throw new Error("User not found");
            }
            const userData = userDoc.data() as UserData;

            // Fetch userSubscription data from Firestore
            const subscriptionRef = doc(db, 'users', userId, 'subscriptions', userId);
            const subscriptionDoc = await getDoc(subscriptionRef);
            const subscriptionData = subscriptionDoc.exists() ? subscriptionDoc.data() as UserSubscription : null;

            // Fetch userSubscriptionHistory data from Firestore
            const subscriptionHistoryRef = collection(db, 'users', userId, 'subscriptionHistory');
            const subscriptionHistoryQuery = query(subscriptionHistoryRef, orderBy("createdAt", "desc"));
            const subscriptionHistorySnapshot = await getDocs(subscriptionHistoryQuery);
            const subscriptionHistoryData = subscriptionHistorySnapshot.docs.map((doc) => doc.data() as SubscriptionHistory);
            userStore.update((store) => ({
                ...store,
                isLoading: false,
                currentUser: {
                    ...userData,
                    id: userDoc.id,
                },
                subscription: subscriptionData
                    ? { ...subscriptionData, id: subscriptionDoc.id, }
                    : null,
                subscriptionHistory: subscriptionHistoryData,
            }));
            console.log({ userData, subscriptionData, subscriptionHistoryData });
            return { userData, subscriptionData, subscriptionHistoryData };
        } catch (error) {
            console.error("Error getting user:", error);
            userStore.update((store) => ({
                ...store,
                isLoading: false,
            }));
            throw error;
        }

    },

    getUserWithSubscription: async (subscriptionId: string) => {
        if (!subscriptionId) {
            throw new Error("Subscription ID is required");
        }

        try {
            const res = await fetch('/api/user/get-by-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId })
            });

            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error || `Failed to get user with subscription: ${res.statusText}`);
            }

            const userId = await res.json();
            return userId;
        } catch (error) {
            console.error("Error getting user with subscription:", error);
            throw error;
        }
    },
    updateUserSubscription: async (userId: string, updatedData: Partial<UserSubscription>) => {
        /**
         * Update user subscription data in Firestore (is used after a user has successfully subscribed to a plan)
         */
        if (!userId) {
            throw new Error("User ID is required");
        }

        try {
            const res = await fetch('/api/subscription/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, updatedData })
            });

            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            userStore.update((state) => ({
                ...state,
                isLoading: false,
                subscription: { ...data, id: userId },
            }))
            return data;

        } catch (error) {
            console.error("Error updating user:", error);
            userStore.update((state) => ({
                ...state,
                isLoading: false,
            })
            );
            throw error;
        }
    },

    cancelSubscription: async (userId: string) => {
        if (!userId) {
            throw new Error("User ID is required");
        }

        try {
            const res = await fetch(`/api/subscription/cancel`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.message || "Failed to cancel subscription");
            }
            return data;
        } catch (error) {
            console.error("Error canceling subscription:", error);
            throw error;
        }
    },

    subscribe: async (userId: string, priceId: string, promoCode: string) => {
        /**
         * This function is used to subscribe a user to a subscription.
         */
        if (!userId) {
            throw new Error("User ID is required");
        }
        if (!priceId) {
            throw new Error("Price ID is required");
        }

        try {
            const res = await fetch(`/api/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, priceId: priceId, promoCode }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.message || "Failed to subscribe");
            }
            return data.url;
        } catch (error) {
            console.error("Error subscribing:", error);
            throw error;
        }
    },

    getSubscriptionHistory: async (userId: string) => {
        if (!userId) {
            throw new Error("User ID is required");
        }
        try {
            const res = await fetch(`/api/subscription/history`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId }),
            });

            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error || "Failed to get subscription history");
            }

            const data = await res.json();
            return data;
        } catch (error) {
            console.error("Error getting subscription history:", error);
            throw error;
        }
    },
}