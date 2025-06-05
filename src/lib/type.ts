export interface Company {
    id: string;
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
    employees: string[];
    locations: string[];
}

export interface User {
    id: string;
    email: string;
    name: string;
    insightLookup: boolean; // user subscribes to insight lookup
    companyId: string;
    currentLocationId: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}

export interface Location {
    id: string;
    companyId: string;
    name: string;
    address: string;
    insightCertified: boolean;
    employees: string[],
}

export interface Subscription {
    // short info of the subscription
    id: string; // subscription id
    name: string;
    priceId: string;
    status: "active" | "canceled" | "unpaid" | "paused" | "incomplete_expired" | "past_due";
    amountSubtotal: number; // in cents
    amountTotal: number; // in cents, final price after discount
    currency: string;
    currentPeriodStart: string; // ISO string
    currentPeriodEnd: string; // ISO string
    stripeCustomerId?: string; // Stripe customer ID

}

export interface CardInfo {
    cardId: string;
    cardOwnerName: string;
    cardBrand: string;
    cardLast4: string;
    cardExpiry: string
}

export interface SubscriptionUserList {
    id: string; // user id
    subscriptions: Subscription[]; // list of subscription belongs to the user (the user subscribes to)
    cardInfo: CardInfo;
    payerUserId: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}


export interface SubscriptionLocationList extends SubscriptionUserList {
    // id = location id
}

// History of the subscription
export interface SubscriptionUserItem {
    id: string; // subscription id
    userId: string;

    subscriptionId: string;
    subscriptionName: string
    priceId: string;
    status: "active" | "canceled" | "unpaid" | "paused" | "incomplete_expired" | "past_due";

    amountSubtotal: number; // in cents
    amountTotal: number; // in cents, final price after discount
    currency: string;
    discounts?: string | null;

    currentPeriodStart: string; // ISO string
    currentPeriodEnd: string; // ISO string

    invoiceId: string; // invoice of this subscription item
    invoiceLink: string; // link to the invoice
    paymentStatus: "paid" | "unpaid" | "partially_paid";
    paidDate: string | null; // ISO string

    taxData: {
        rate: number | string | null;
        amount: number; // in cents
    }
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}



export interface SubscriptionLocationItem extends SubscriptionUserItem {
    locationId: string;
}


export interface SubscriptionCompanyList {
    id: string; // company id
    subscriptionIds: string[]; // list of subscription belongs to the company
    cardInfo: {
        cardId: string;
        cardOwnerName: string;
        cardBrand: string;
        cardLast4: string;
        cardExpiry: string;
    }
    createdAt: string; // ISO string
    updatedAt: string; // ISO string

}
