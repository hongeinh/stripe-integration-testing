import { writable } from "svelte/store";
import { db } from "$lib/firebase";
import type { User, SubscriptionUserItem, SubscriptionUserList, SubscriptionLocationList, Location } from "$lib/type";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export const userStore = writable<{
    isLoading: boolean;
    currentUser: User | null;
    userSubscriptions: SubscriptionUserList | null;
    locationSubscriptions: SubscriptionLocationList | null;
}>({
    isLoading: true,
    currentUser: null,
    userSubscriptions: null,
    locationSubscriptions: null,
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
            const userData = userDoc.data() as User;

            // Fetch userSubscription data from Firestore
            const subscriptionRef = doc(db, 'subscriptionUserList', userId);
            const subscriptionDoc = await getDoc(subscriptionRef);
            const subscriptionData = (subscriptionDoc.exists() ? subscriptionDoc.data() : null) as SubscriptionUserList;

            // Fetch locationSubscription data from Firestore
            const locationSubscriptionRef = doc(db, 'subscriptionLocationList', userData.currentLocationId);
            const locationSubscriptionDoc = await getDoc(locationSubscriptionRef);
            const locationSubscriptionData = (locationSubscriptionDoc.exists() ? locationSubscriptionDoc.data() : null) as SubscriptionLocationList;

            // Fetch userSubscriptionHistory data from Firestore
            userStore.update((store) => ({
                ...store,
                isLoading: false,
                currentUser: {
                    ...userData,
                    id: userDoc.id,
                },
                userSubscriptions: subscriptionData
                    ? { ...subscriptionData }
                    : null,
                locationSubscriptions: locationSubscriptionData
                    ? { ...locationSubscriptionData }
                    : null,
            }));
            console.log({ userData, subscriptionData, locationSubscriptionData });
            return { userData, subscriptionData, locationSubscriptionData };
        } catch (error) {
            console.error("Error getting user:", error);
            userStore.update((store) => ({
                ...store,
                isLoading: false,
            }));
            throw error;
        }

    },

    changeEmployeeLocation: async (locationId: string, userId: string, newLocationId: string) => {
        if (!locationId || !userId || !newLocationId) {
            throw new Error("Location ID and User ID are required");
        }

        try {
            // update old location
            const locationRef = doc(db, 'locations', locationId);
            const locationDoc = await getDoc(locationRef);
            const locationData = locationDoc.data() as Location;
            locationData.employees = locationData.employees.filter((user) => user !== userId);
            await updateDoc(locationRef, { employeeIds: locationData.employees });

            // update user location
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data() as User;
            userData.currentLocationId = newLocationId;
            await updateDoc(userRef, { currentLocationId: newLocationId });

            // update new location
            const newLocationRef = doc(db, 'locations', newLocationId);
            const newLocationDoc = await getDoc(newLocationRef);
            const newLocationData = newLocationDoc.data() as Location;
            newLocationData.employees.push(userId);
            await updateDoc(newLocationRef, { employeeIds: newLocationData.employees });

            await updateDoc(userRef, {
                ...userData,
            });
            return userData;
        } catch (error) {
            console.error("Error updating user location", error);
            return null;
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
    updateUserSubscription: async (userId: string, updatedData: Partial<SubscriptionUserItem>) => {
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
                userSubscriptions: { ...data, id: userId },
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

    cancelSubscription: async (userId: string, subscriptionId: string, type: "user" | "location") => {
        if (!userId) {
            throw new Error("User ID is required");
        }

        try {
            const res = await fetch(`/api/subscription/cancel`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, subscriptionId, type }),
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

    subscribe: async (userId: string, locationId: string, priceId: string, promoCode: string) => {
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
                body: JSON.stringify({ userId, priceId: priceId, promoCode, locationId }),
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


    updateUserLocation: async (userId: string, locationId: string) => {
        if (!userId || !locationId) {
            throw new Error("User ID and Location ID are required");
        }

        try {
            const res = await fetch(`/api/user/update-location`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, locationId }),
            });

            if (!res.ok) {
                const { error } = await res.json();
                throw new Error(error || "Failed to update user location");
            }

            const data = await res.json();
            userStore.update((store) => ({
                ...store,
                currentUser: store.currentUser ? {
                    ...store.currentUser,
                    currentLocationId: locationId
                } : null
            }));
            return data;
        } catch (error) {
            console.error("Error updating user location:", error);
            throw error;
        }
    },


}