import { db } from "$lib/firebase";
import type { Location, SubscriptionLocationItem } from "$lib/type";
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";



export const locationHandler = {
    getLocation: async (locationId: string) => {
        if (!locationId) {
            throw new Error("Location ID is required");
        }

        try {
            const locationRef = doc(db, 'locations', locationId);
            const locationDoc = await getDoc(locationRef);
            const locationData = locationDoc.data() as Location;
            return locationData;
        } catch (error) {
            console.error("Error fetching location", error);
            return null;
        }
    },

    getLocations: async (companyId: string) => {
        if (!companyId) {
            throw new Error("Company ID is required");
        }

        try {
            const locationsRef = collection(db, 'locations');
            const q = query(locationsRef, where('companyId', '==', companyId));
            const locationsDoc = await getDocs(q);
            const locationsData = locationsDoc.docs.map((doc) => ({
                id: doc.id,
                ...doc.data()
            } as Location));

            return locationsData;
        } catch (error) {
            console.error("Error fetching locations", error);
            return null;
        }
    },

    getLocationSubscriptionItems: async (locationId: string, subscriptionId: string) => {
        if (!locationId) {
            throw new Error("Location ID is required");
        }

        try {
            const locationCollectionRef = collection(db, 'subscriptionLocationList');
            const q = query(locationCollectionRef, where('locationId', '==', locationId), where('subscriptionId', '==', subscriptionId));
            const locationSnapshot = await getDocs(q);
            const locationData = locationSnapshot.docs.map((doc) => doc.data() as SubscriptionLocationItem);
            return locationData;
        } catch (error) {
            console.error("Error fetching location subscription item", error);
            return null;
        }
    },

}
