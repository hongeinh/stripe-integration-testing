import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { adminDb } from "$lib/firebase-admin.js";
import type { Subscription, SubscriptionUserItem, SubscriptionUserList, SubscriptionLocationItem, SubscriptionLocationList } from "$lib/type.js";
import { v4 as uuidv4 } from "uuid";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});
const endpointSecret = import.meta.env.VITE_STRIPE_WEBHOOK_SECRET;

export async function POST({ request }) {
    const sig = request.headers.get("stripe-signature");
    const body = await request.text();

    if (!sig) {
        return new Response("Webhook error: Missing Stripe signature header", { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Error: ${(err as Error).message}`);
        return new Response(`Webhook Error: ${err}`, { status: 400 });
    }

    try {
        console.log("Received event:", event.type);
        if (event.type === "checkout.session.completed") {
            await handleCheckoutSessionCompleted(event);
        } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
            await handleEventSubscriptionUpdate(event);
        } else if (event.type === "invoice.payment_succeeded") {
            await handleInvoicePaymentSucceeded(event);
        } else if (event.type === "invoice.payment_failed") {
            await handleInvoicePaymentFailed(event);
        }
        return json({ received: true });
    } catch (error) {
        console.error(`Error processing event ${event.type}:`, error);
        return new Response(`Error processing event: ${(error as Error).message}`, { status: 500 });
    }
}

async function handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = session.subscription as string;
    const clientReferenceId = session.client_reference_id;
    const appliedPromoCode = session?.discounts?.[0]?.promotion_code || null;
    
    if (!clientReferenceId || !subscriptionId) {
        return new Response(`Missing clientReferenceId or subscriptionId: ${clientReferenceId}, ${subscriptionId}`, { status: 400 });
    }

    const userId = session.metadata?.["userId"];
    const locationId = session.metadata?.["locationId"];

    if (!userId) {
        throw new Error("User ID is required");
    }

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price", "items.data.plan.product"] });
        const item = subscription.items.data[0];
        const product = item.plan?.product as Stripe.Product;
        const metadataType = product.metadata?.["type"]; // "user" or "location"
        const price = item.price;

        let subscriptionName = product?.name || "Subscription";
        const currentPeriodStart = convertNumberTimeToISO(subscription.items.data[0].current_period_start);
        const currentPeriodEnd = convertNumberTimeToISO(subscription.items.data[0].current_period_end);

        const subscriptionData: Subscription = {
            id: subscriptionId,
            name: subscriptionName,
            priceId: price.id,
            status: subscription.status as Subscription["status"],
            amountSubtotal: price.unit_amount || 0,
            amountTotal: session.amount_total || price.unit_amount || 0,
            currency: price.currency || "usd",
            currentPeriodStart: currentPeriodStart,
            stripeCustomerId: subscription.customer as string,
            currentPeriodEnd: currentPeriodEnd,
        };

        const subscriptionItem: SubscriptionUserItem = {
            id: uuidv4(),
            userId,
            subscriptionId,
            subscriptionName,
            priceId: price.id,
            status: subscription.status as Subscription["status"],
            amountSubtotal: price.unit_amount || 0,
            amountTotal: session.amount_total || price.unit_amount || 0,
            currency: price.currency || "usd",
            discounts: appliedPromoCode as string,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            invoiceId: session.invoice as string || "",
            invoiceLink: session.invoice ? `https://pay.stripe.com/invoice/${session.invoice}` : "",
            paymentStatus: session.payment_status === "paid" ? "paid" : "unpaid",
            paidDate: session.payment_status === "paid" ? new Date().toISOString() : null,
            taxData: {
                rate: session.total_details?.breakdown?.taxes?.[0]?.rate?.percentage || 0,
                amount: session.total_details?.amount_tax || 0,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (metadataType === "user") {
            await updateUserSubscriptionList(userId, subscriptionData);
            await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem);
        } else if (metadataType === "location") {
            if (!locationId) {
                throw new Error("Location ID is required for location subscription");
            }
            (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
            await updateLocationSubscriptionList(locationId, subscriptionData);
            await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem);
        } else {
            throw new Error(`Invalid metadata type: ${metadataType}`);
        }

    } catch (error) {
        console.error("Error handling checkout.session.completed:", error);
        throw error;
    }

}

async function handleEventSubscriptionUpdate(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionId = subscription.id;

    console.log("old subscription", subscription);
    try {
        const expandedSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price.product", "customer"],
        });
        const item = expandedSubscription.items.data[0];
        const product = item.price.product as Stripe.Product;
        const metadataType = product.metadata.type;

        let status: Subscription["status"] = expandedSubscription.status as Subscription["status"];
        if (event.type === "customer.subscription.deleted") {
            status = "canceled";
        }

        const currentPeriodStart = convertNumberTimeToISO(expandedSubscription.items.data[0].current_period_start);
        const currentPeriodEnd = convertNumberTimeToISO(expandedSubscription.items.data[0].current_period_end);

        const subscriptionData: Subscription = {
            id: subscriptionId,
            name: product.name || "Subscription",
            priceId: item.price.id,
            status,
            amountSubtotal: item.price.unit_amount || 0,
            amountTotal: item.price.unit_amount || 0,
            currency: item.price.currency || "usd",
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            stripeCustomerId: expandedSubscription.customer as string,
        };

        const subscriptionItem: SubscriptionUserItem | SubscriptionLocationItem = {
            id: uuidv4(),
            userId: "",
            subscriptionId,
            subscriptionName: product.name || "Subscription",
            priceId: item.price.id,
            status,
            amountSubtotal: item.price.unit_amount || 0,
            amountTotal: item.price.unit_amount || 0,
            currency: item.price.currency || "usd",
            discounts: expandedSubscription.discounts?.[0]?.toString() || null,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            invoiceId: expandedSubscription.latest_invoice as string || "",
            invoiceLink: expandedSubscription.latest_invoice ? `https://pay.stripe.com/invoice/${expandedSubscription.latest_invoice}` : "",
            paymentStatus: expandedSubscription.status === "active" ? "paid" : "unpaid",
            paidDate: expandedSubscription.status === "active" ? new Date().toISOString() : null,
            taxData: {
                rate: 0, // Tax data not available in subscription update
                amount: 0,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (metadataType === "user") {
            const userId = await getUserWithSubscription(subscriptionId);
            if (!userId) {
                throw new Error(`User not found for subscription ${subscriptionId}`);
            }
            subscriptionItem.userId = userId;
            await updateUserSubscriptionList(userId, subscriptionData);
            await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem);
        } else if (metadataType === "location") {
            const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
            if (!locationId || !userId) {
                throw new Error(`Location or user not found for subscription ${subscriptionId}`);
            }
            (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
            subscriptionItem.userId = userId;
            await updateLocationSubscriptionList(locationId, subscriptionData);
            await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem);
        } else {
            throw new Error(`Invalid metadata type: ${metadataType}`);
        }

        console.log(`Processed ${event.type} for ${metadataType} subscription ${subscriptionId}`);
    } catch (error) {
        console.error(`Error handling ${event.type}:`, error);
        throw error;
    }
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.parent?.subscription_details?.subscription as string;

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price.product"],
        });
        const item = subscription.items.data[0];
        const product = item.price.product as Stripe.Product;
        const metadataType = product.metadata.type;

        const currentPeriodStart = convertNumberTimeToISO(subscription.items.data[0].current_period_start);
        const currentPeriodEnd = convertNumberTimeToISO(subscription.items.data[0].current_period_end);

        const subscriptionData: Partial<Subscription> = {
            id: subscriptionId,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            status: subscription.status as Subscription["status"],
        };

        const subscriptionItem: SubscriptionUserItem = {
            id: uuidv4(),
            userId: "", // Will be set after fetching
            subscriptionId,
            subscriptionName: product.name || "Subscription",
            priceId: item.price.id,
            status: subscription.status as Subscription["status"],
            amountSubtotal: invoice.subtotal || item.price.unit_amount || 0,
            amountTotal: invoice.total || item.price.unit_amount || 0,
            currency: invoice.currency || item.price.currency || "usd",
            discounts: invoice.discounts?.[0]?.toString() || null,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            invoiceId: invoice.id || "",
            invoiceLink: invoice.hosted_invoice_url || `https://pay.stripe.com/invoice/${invoice.id}`,
            paymentStatus: "paid",
            paidDate: new Date().toISOString(),
            taxData: {
                rate: invoice.total_taxes?.[0]?.tax_rate_details?.tax_rate || 0,
                amount: invoice.total_taxes?.[0]?.amount || 0,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (metadataType === "user") {
            const userId = await getUserWithSubscription(subscriptionId);
            if (!userId) {
                throw new Error(`User not found for subscription ${subscriptionId}`);
            }
            subscriptionItem.userId = userId;
            await updateUserSubscriptionList(userId, subscriptionData);
            await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem);
        } else if (metadataType === "location") {
            const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
            if (!locationId || !userId) {
                throw new Error(`Location or user not found for subscription ${subscriptionId}`);
            }
            (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
            subscriptionItem.userId = userId;
            await updateLocationSubscriptionList(locationId, subscriptionData);
            await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem);
        } else {
            throw new Error(`Invalid metadata type: ${metadataType}`);
        }

        console.log(`Processed invoice.payment_succeeded for ${metadataType} subscription ${subscriptionId}`);
    } catch (error) {
        console.error("Error handling invoice.payment_succeeded:", error);
        throw error;
    }
}

async function handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.parent?.subscription_details?.subscription as string;

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price.product"],
        });
        const item = subscription.items.data[0];
        const product = item.price.product as Stripe.Product;
        const metadataType = product.metadata.type;

        const subscriptionData: Partial<Subscription> = {
            id: subscriptionId,
            status: subscription.status as Subscription["status"],
        };

        const currentPeriodStart = convertNumberTimeToISO(subscription.items.data[0].current_period_start);
        const currentPeriodEnd = convertNumberTimeToISO(subscription.items.data[0].current_period_end);
        const subscriptionItem: SubscriptionUserItem = {
            id: uuidv4(),
            userId: "", // Will be set after fetching
            subscriptionId,
            subscriptionName: product.name || "Subscription",
            priceId: item.price.id,
            status: subscription.status as Subscription["status"],
            amountSubtotal: invoice.subtotal || item.price.unit_amount || 0,
            amountTotal: invoice.total || item.price.unit_amount || 0,
            currency: invoice.currency || item.price.currency || "usd",
            discounts: subscription.discounts?.[0]?.toString() || null,
            currentPeriodStart: currentPeriodStart,
            currentPeriodEnd: currentPeriodEnd,
            invoiceId: invoice.id || "",
            invoiceLink: invoice.hosted_invoice_url || `https://pay.stripe.com/invoice/${invoice.id}`,
            paymentStatus: "unpaid",
            paidDate: null,
            taxData: {
                rate: invoice.total_taxes?.[0]?.tax_rate_details?.tax_rate || 0,
                amount: invoice.total_taxes?.[0]?.amount || 0,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        if (metadataType === "user") {
            const userId = await getUserWithSubscription(subscriptionId);
            if (!userId) {
                throw new Error(`User not found for subscription ${subscriptionId}`);
            }
            subscriptionItem.userId = userId;
            await updateUserSubscriptionList(userId, subscriptionData);
            await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem);
        } else if (metadataType === "location") {
            const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
            if (!locationId || !userId) {
                throw new Error(`Location or user not found for subscription ${subscriptionId}`);
            }
            (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
            subscriptionItem.userId = userId;
            await updateLocationSubscriptionList(locationId, subscriptionData);
            await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem);
        } else {
            throw new Error(`Invalid metadata type: ${metadataType}`);
        }

        console.log(`Processed invoice.payment_failed for ${metadataType} subscription ${subscriptionId}`);
    } catch (error) {
        console.error("Error handling invoice.payment_failed:", error);
        throw error;
    }
}

async function updateUserSubscriptionList(userId: string, subscriptionData: Partial<Subscription>) {
    const subscriptionListRef = adminDb.collection("subscriptionUserList").doc(userId);
    const subscriptionListDoc = await subscriptionListRef.get();
    let subscriptionList: SubscriptionUserList = subscriptionListDoc.exists
        ? subscriptionListDoc.data() as SubscriptionUserList
        : {
            id: userId,
            subscriptions: [],
            cardInfo: { cardId: "", cardOwnerName: "", cardBrand: "", cardLast4: "", cardExpiry: "" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

    const existingIndex = subscriptionList.subscriptions.findIndex(sub => sub.id === subscriptionData.id);
    if (existingIndex >= 0) {
        subscriptionList.subscriptions[existingIndex] = {
            ...subscriptionList.subscriptions[existingIndex],
            ...subscriptionData,
        };
    } else {
        subscriptionList.subscriptions.push(subscriptionData as Subscription);
    }

    subscriptionList.updatedAt = new Date().toISOString();
    await subscriptionListRef.set(subscriptionList);
}

async function updateLocationSubscriptionList(locationId: string, subscriptionData: Partial<Subscription>) {
    const subscriptionListRef = adminDb.collection("subscriptionLocationList").doc(locationId);
    const subscriptionListDoc = await subscriptionListRef.get();
    let subscriptionList: SubscriptionLocationList = subscriptionListDoc.exists
        ? subscriptionListDoc.data() as SubscriptionLocationList
        : {
            id: locationId,
            subscriptions: [],
            cardInfo: { cardId: "", cardOwnerName: "", cardBrand: "", cardLast4: "", cardExpiry: "" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

    const existingIndex = subscriptionList.subscriptions.findIndex(sub => sub.id === subscriptionData.id);
    if (existingIndex >= 0) {
        subscriptionList.subscriptions[existingIndex] = {
            ...subscriptionList.subscriptions[existingIndex],
            ...subscriptionData,
        };
    } else {
        subscriptionList.subscriptions.push(subscriptionData as Subscription);
    }

    subscriptionList.updatedAt = new Date().toISOString();
    await subscriptionListRef.set(subscriptionList);
}

async function addUserSubscriptionItem(userId: string, item: SubscriptionUserItem) {
    const subscriptionItemRef = adminDb.collection("subscriptionUserItem").doc(uuidv4());
    await subscriptionItemRef.set(item);
}

async function addLocationSubscriptionItem(locationId: string, item: SubscriptionLocationItem) {
    const subscriptionItemRef = adminDb.collection("subscriptionLocationItem").doc(uuidv4());
    await subscriptionItemRef.set(item);
}

async function getUserWithSubscription(subscriptionId: string) {
    if (!subscriptionId) {
        throw new Error("Subscription ID is required");
    }

    try {
        const userSnapshot = await adminDb.collection("subscriptionUserList")
            .where("subscriptions.id", "==", subscriptionId)
            .limit(1)
            .get();
        console.log({ userSnapshot });
        return userSnapshot.empty ? null : userSnapshot.docs[0].id;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getLocationWithSubscription(subscriptionId: string) {
    if (!subscriptionId) {
        throw new Error("Subscription ID is required");
    }

    try {
        const locationSnapshot = await adminDb.collection("subscriptionLocationList")
            .where("subscriptions.id", "==", subscriptionId)
            .limit(1)
            .get();
        if (locationSnapshot.empty) {
            return { userId: null, locationId: null };
        }

        // Get the userId from the corresponding subscriptionLocationItem
        const itemSnapshot = await adminDb.collection("subscriptionLocationItem")
            .where("subscriptionId", "==", subscriptionId)
            .limit(1)
            .get();

        const userId = itemSnapshot.empty ? null : itemSnapshot.docs[0].data().userId;
        return {
            userId: userId as string,
            locationId: locationSnapshot.docs[0].id
        };
    } catch (error) {
        console.error("Error fetching location with subscription:", error);
        return { userId: null, locationId: null };
    }
}

function convertNumberTimeToISO(time: number | string) {
    if (typeof time === "number") {
        return new Date(time * 1000).toISOString();
    }
    return time || "";
}
