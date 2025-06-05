import type { SubscriptionUserItem, SubscriptionLocationItem, SubscriptionUserList, SubscriptionLocationList } from "$lib/type";

export const subscriptionHandlers = {
    getSubscriptionUserList: async (userId: string) => {
        const response = await fetch(`/api/subscription/list?userId=${userId}&type=user`);
        const data = await response.json();
        return data as SubscriptionUserList[];
    },
    getSubscriptionLocationList: async (locationId: string) => {
        const response = await fetch(`/api/subscription/list?locationId=${locationId}&type=location`);
        const data = await response.json();
        return data as SubscriptionLocationList[];
    },
    getSubscriptionUserItems: async (userId: string, subscriptionId: string) => {
        const response = await fetch(`/api/subscription/items?userId=${userId}&subscriptionId=${subscriptionId}&type=user`);
        const data = await response.json();
        return data as SubscriptionUserItem[];
    },
    getSubscriptionLocationItems: async (locationId: string, subscriptionId: string) => {
        const response = await fetch(`/api/subscription/items?locationId=${locationId}&subscriptionId=${subscriptionId}&type=location`);
        const data = await response.json();
        console.log("Subscription Location Items", data);
        return data as SubscriptionLocationItem[];
    }
}


