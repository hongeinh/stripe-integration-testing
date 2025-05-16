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
    employeeIds: string[],
}


export interface SubscriptionUserList {
    id: string; // user id
    subscriptionIds: string[]; // list of subscription belongs to the user (the user subscribes to)
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



export interface SubscriptionUserItem {
    id: string; // subscription id
    userId: string;

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
        rate: number;
        amount: number; // in cents
    }
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
}



export interface SubscriptionLocationList {
    id: string; // location id
    subscriptionIds: string[]; // list of subscription belongs to the location
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

export interface SubscriptionLocationItem {
    id: string; // subscription id
    locationId: string;
    userId: string; // user who initiated the subscription

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
        rate: number;
        amount: number; // in cents
    }
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
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
