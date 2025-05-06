import { writable } from "svelte/store";
import { db } from "$lib/firebase";
import { adminDb } from "$lib/firebase-admin";
import type { UserData } from "$lib/type";
import { doc, getDoc } from "firebase/firestore";

export const userStore = writable<{
    isLoading: boolean;
    currentUser: UserData | null;
}>({
    isLoading: true,
    currentUser: null,
});

export const userHandler = {
    getUser: async (userId: string) => {
        if (!userId) {
            throw new Error("User ID is required");
        }

        try {
            const userRef = doc(db, "users", userId);
            const userDoc = await getDoc(userRef);
            if (!userDoc.exists()) {
                throw new Error("User not found");
            }
            const userData = userDoc.data() as UserData;
            userStore.set({
                isLoading: false,
                currentUser: {
                    ...userData,
                    id: userDoc.id,
                },
            });
            return userData;
        } catch (error) {
            console.error("Error getting user:", error);
            userStore.set({
                isLoading: false,
                currentUser: null,
            });
            throw error;
        }

    },

    getUserWithSubscription: async (subscriptionId: string) => {
        if (!subscriptionId) {
            throw new Error("Subscription ID is required");
        }

        try {
            const usersSnapshot = await adminDb.collection("users").where("subscriptionId", "==", subscriptionId).limit(1).get();

            if (usersSnapshot.empty) {
                console.warn("No user found with the provided subscription ID.");
                return null;
            }

            return usersSnapshot.docs[0].id;
        } catch (error) {
            console.error("Error getting user with subscription:", error);
            throw error;
        }
    },
    updateUser: async (userId: string, updatedData: Partial<UserData>) => {
        if (!userId) {
            throw new Error("User ID is required");
        }

        try {
            const userRef = adminDb.collection("users").doc(userId);
            const userDoc = await userRef.get();
            const userData = userDoc.data() as UserData;
            if (updatedData.email && updatedData.email !== userData.email) {
                userData.email = updatedData.email;
            }
            if (updatedData.name && updatedData.name !== userData.name) {
                userData.name = updatedData.name;
            }

            if (updatedData.subscriptionId && updatedData.subscriptionId !== userData.subscriptionId) {
                userData.subscriptionId = updatedData.subscriptionId;
                if (updatedData.status === "active") {
                    userData.status = updatedData.status;
                    userData.currentPeriodStart = updatedData.currentPeriodStart
                        ? typeof updatedData.currentPeriodStart === "number"
                            ? new Date(updatedData.currentPeriodStart * 1000).toISOString()
                            : userData.currentPeriodStart
                        : userData.currentPeriodStart;
                    userData.currentPeriodEnd = updatedData.currentPeriodEnd
                        ? typeof updatedData.currentPeriodEnd === "number"
                            ? new Date(updatedData.currentPeriodEnd * 1000).toISOString()
                            : userData.currentPeriodEnd
                        : userData.currentPeriodEnd;

                }

                if (updatedData.promoCode) {
                    userData.promoCode = updatedData.promoCode;
                }
            }

            if (updatedData.status === "canceled" || updatedData.status === "expired" || updatedData.status === "inactive") {
                userData.status = updatedData.status;
                userData.subscriptionId = "";
                userData.currentPeriodEnd = "";
                userData.currentPeriodStart = "";
            }

            userData.updatedAt = new Date().toISOString();

            if (userDoc.exists) {
                await userRef.update(userData);
            } else {
                await userRef.set(userData);
            }
            userStore.set({
                isLoading: false,
                currentUser: {
                    ...userData,
                    id: userDoc.id,
                },
            });
            return userData;
        } catch (error) {
            console.error("Error updating user:", error);
            userStore.set({
                isLoading: false,
                currentUser: null,
            });
            throw error;
        }
    },

    cancelSubscription: async (userId: string) => {
        if (!userId) {
            throw new Error("User ID is required");
        }

        try {
            const res = await fetch(`/api/subscribe/cancel`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId }),
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            return data;
        } catch (error) {
            console.error("Error canceling subscription:", error);
            throw error;
        }
    },

    subscribe: async (userId: string, subscriptionId: string, promoCode: string) => {
        if (!userId) {
            throw new Error("User ID is required");
        }
        if (!subscriptionId) {
            throw new Error("Subscription ID is required");
        }

        try {
            const res = await fetch(`/api/subscribe`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, priceId: subscriptionId, promoCode }),
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            return data.url;
        } catch (error) {
            console.error("Error subscribing:", error);
            throw error;
        }
    },

    renewSubscription: async (userId: string) => {
        if (!userId) {
            throw new Error("User ID is required");
        }

        try {
            const res = await fetch(`/api/subscribe/renew`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId }),
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            return data;
        } catch (error) {
            console.error("Error renewing subscription:", error);
            throw error;
        }
    }
}