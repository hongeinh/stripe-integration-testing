export type UserData = {
    id: string;
    email: string;
    name: string;
    subscriptionId: string;
    stripePriceId: string;
    currentPeriodEnd: string;
    currentPeriodStart: string;
    status: "active" | "canceled" | "expired" | "inactive";
    promoCode: string | null;
    createdAt: string;
    updatedAt: string;
}