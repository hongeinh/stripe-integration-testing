export interface UserData {
    id: string;
    email: string;
    name: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}


export interface UserSubscription {
    id: string; // user id for 1-1 relationship
    userId: string;
    subscriptionId: string;
    subscriptionName: string
    currentPeriodStart: string; // ISO string
    currentPeriodEnd: string; // ISO string
    priceId: string;
    priceAmount: number; // in cents
    currency: string;
    status: "active" | "canceled" | "expired" | "inactive";
    promoCode?: string | null;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

export interface SubscriptionHistory {
    id: string;
    userId: string;
    subscriptionId: string;
    subscriptionName: string;
    priceId: string;
    priceAmount: number; // in cents
    periodStart: string; // ISO string
    periodEnd: string; // ISO string
    currency: string;
    promoCode?: string | null;
    paid: boolean; // whether payment was successful
    createdAt: string; // ISO string
}