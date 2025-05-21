import Stripe from "stripe";
import { json } from "@sveltejs/kit";
import { adminDb } from "$lib/firebase-admin.js";
import type { Subscription, SubscriptionUserItem, SubscriptionUserList, SubscriptionLocationItem, SubscriptionLocationList, CardInfo } from "$lib/type.js";
import { v4 as uuidv4 } from "uuid";

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});
const endpointSecret = import.meta.env.VITE_STRIPE_WEBHOOK_SECRET;

const processedEventIds = new Set<string>(); // prevent duplicate event processing

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

    if (processedEventIds.has(event.id)) {
        return new Response("Event already processed", { status: 200 });
    }

    try {
        console.log("Received event:", event.type);
        await adminDb.runTransaction(async (transaction) => {
            if (event.type === "checkout.session.completed") {
                await handleCheckoutSessionCompleted(event, transaction);
            } else if (event.type == "customer.subscription.created") {
                await handleSubscriptionCreated(event, transaction);
            } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
                await handleEventSubscriptionUpdate(event, transaction);
            } else if (event.type === "invoice.payment_succeeded") {
                await handleInvoicePaymentSucceeded(event, transaction);
            } else if (event.type === "invoice.payment_failed") {
                await handleInvoicePaymentFailed(event, transaction);
            } else if (event.type === "payment_intent.succeeded") {
                // await handlePaymentIntentSucceeded(event, transaction);
            }
        });
        processedEventIds.add(event.id);
        return json({ received: true });
    } catch (error) {
        console.error(`Error processing event ${event.type}:`, error);
        return new Response(`Error processing event: ${(error as Error).message}`, { status: 500 });
    }
}

async function handleCheckoutSessionCompleted(event: Stripe.Event, transaction: FirebaseFirestore.Transaction) {
    console.log("handleCheckoutSessionCompleted", JSON.stringify(event, null, 2));
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

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price", "items.data.plan.product"] });
    const item = subscription.items.data[0];
    const product = item.plan?.product as Stripe.Product;
    const metadataType = product.metadata?.["type"]; // "user" or "location"
    const price = item.price;

    const cardInfo = {
        cardId: "",
        cardOwnerName: "",
        cardBrand: "",
        cardLast4: "",
        cardExpiry: "",
    }

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
        currentPeriodEnd: currentPeriodEnd,
        stripeCustomerId: subscription.customer as string,
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
        currentPeriodStart,
        currentPeriodEnd,
        invoiceId: session.invoice as string || "",
        invoiceLink: session.invoice ? `https://pay.stripe.com/invoice/${session.invoice}` : "",
        paymentStatus: session.payment_status === "paid" ? "paid" : "unpaid",
        paidDate: session.payment_status === "paid" ? new Date().toISOString() : null,
        taxData: {
            rate: session.total_details?.amount_tax && session.amount_subtotal ?
                (session.total_details.amount_tax / session.amount_subtotal * 100) : 0,
            amount: session.total_details?.amount_tax || 0,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    if (metadataType === "user") {
        await updateUserSubscriptionList(userId, subscriptionData, cardInfo, transaction);
        await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem, transaction);
        const userRef = adminDb.collection("users").doc(userId);
        transaction.update(userRef, { insightLookup: true });
    } else if (metadataType === "location") {
        if (!locationId) {
            throw new Error("Location ID is required for location subscription");
        }
        (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
        await updateLocationSubscriptionList(locationId, subscriptionData, cardInfo, userId, transaction);
        await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem, transaction);
        const locationRef = adminDb.collection("locations").doc(locationId);
        transaction.update(locationRef, { insightCertified: true });
    } else {
        throw new Error(`Invalid metadata type: ${metadataType}`);
    }


}

async function handleSubscriptionCreated(event: Stripe.CustomerSubscriptionCreatedEvent, transaction: FirebaseFirestore.Transaction) {
    console.log("handleSubscriptionCreated", JSON.stringify(event, null, 2));

    const subscriptionId = (event.data.object as Stripe.Subscription).id;
    const expandedSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price.product", "customer"],
    });
    const item = expandedSubscription.items.data[0];
    const product = item.price.product as Stripe.Product;
    const metadataType = product.metadata.type;

    const currentPeriodStart = convertNumberTimeToISO(expandedSubscription.items.data[0].current_period_start);
    const currentPeriodEnd = convertNumberTimeToISO(expandedSubscription.items.data[0].current_period_end);

    const subscriptionData: Subscription = {
        id: subscriptionId,
        name: product.name || "Subscription",
        priceId: item.price.id,
        status: expandedSubscription.status as Subscription["status"],
        amountSubtotal: item.price.unit_amount || 0,
        amountTotal: item.price.unit_amount || 0,
        currency: item.price.currency || "usd",
        currentPeriodStart,
        currentPeriodEnd,
        stripeCustomerId: expandedSubscription.customer as string,
    };

    const subscriptionItem: SubscriptionUserItem = {
        id: uuidv4(),
        userId: "", // update later
        subscriptionId,
        subscriptionName: product.name || "Subscription",
        priceId: item.price.id,
        status: expandedSubscription.status as Subscription["status"],
        amountSubtotal: item.price.unit_amount || 0,
        amountTotal: item.price.unit_amount || 0,
        currency: item.price.currency || "usd",
        discounts: expandedSubscription?.discounts?.[0]?.toString() || null,
        currentPeriodStart,
        currentPeriodEnd,
        invoiceId: expandedSubscription.latest_invoice as string || "",
        invoiceLink: expandedSubscription.latest_invoice ? `https://pay.stripe.com/invoice/${expandedSubscription.latest_invoice}` : "",
        paymentStatus: expandedSubscription.status === "active" ? "paid" : "unpaid",
        paidDate: expandedSubscription.status === "active" ? new Date().toISOString() : null,
        taxData: {
            rate: 0,
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
        await updateUserSubscriptionList(userId, subscriptionData, null, transaction);
        await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem, transaction);
        const userRef = adminDb.collection("users").doc(userId);
        transaction.update(userRef, { insightLookup: true });
    } else if (metadataType === "location") {
        const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
        if (!locationId || !userId) {
            throw new Error(`Location or user not found for subscription ${subscriptionId}`);
        }
        (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
        subscriptionItem.userId = userId;
        await updateLocationSubscriptionList(locationId, subscriptionData, null, userId, transaction);
        await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem, transaction);
        const locationRef = adminDb.collection("locations").doc(locationId);
        transaction.update(locationRef, { insightCertified: true });
    } else {
        throw new Error(`Invalid metadata type: ${metadataType}`);
    }
}


async function handleEventSubscriptionUpdate(event: Stripe.Event, transaction: FirebaseFirestore.Transaction) {
    console.log("handleEventSubscriptionUpdate", JSON.stringify(event, null, 2));

    const subscriptionId = (event.data.object as Stripe.Subscription).id;
    const expandedSubscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price.product", "customer"],
    });
    const item = expandedSubscription.items.data[0];
    const product = item.price.product as Stripe.Product;
    const metadataType = product.metadata.type;

    let status: Subscription["status"] = expandedSubscription.status as Subscription["status"];
    if (event.type === "customer.subscription.deleted") {
        status = "canceled";
        // if (!expandedSubscription.cancel_at_period_end) {
        //     await stripe.subscriptions.update(subscriptionId, {
        //         cancel_at_period_end: true,
        //     });
        // }
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
        userId: "", // update later
        subscriptionId,
        subscriptionName: product.name || "Subscription",
        priceId: item.price.id,
        status,
        amountSubtotal: item.price.unit_amount || 0,
        amountTotal: item.price.unit_amount || 0,
        currency: item.price.currency || "usd",
        discounts: expandedSubscription.discounts?.[0].toString() || null,
        currentPeriodStart: currentPeriodStart,
        currentPeriodEnd: currentPeriodEnd,
        invoiceId: expandedSubscription.latest_invoice as string || "",
        invoiceLink: expandedSubscription.latest_invoice ? `https://pay.stripe.com/invoice/${expandedSubscription.latest_invoice}` : "",
        paymentStatus: expandedSubscription.status === "active" ? "paid" : "unpaid",
        paidDate: expandedSubscription.status === "active" ? new Date().toISOString() : null,
        taxData: {
            rate: 0,
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
        await updateUserSubscriptionList(userId, subscriptionData, null, transaction);
        await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem, transaction);
        const userRef = adminDb.collection("users").doc(userId);
        transaction.update(userRef, {
            insightLookup: status === "active" || (status === "canceled" && new Date() < new Date(currentPeriodEnd)),
        });
    } else if (metadataType === "location") {
        const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
        if (!locationId || !userId) {
            throw new Error(`Location or user not found for subscription ${subscriptionId}`);
        }
        (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
        subscriptionItem.userId = userId;
        await updateLocationSubscriptionList(locationId, subscriptionData, null, userId, transaction);
        await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem, transaction);
        const locationRef = adminDb.collection("locations").doc(locationId);
        transaction.update(locationRef, {
            insightCertified: status === "active" || (status === "canceled" && new Date() < new Date(currentPeriodEnd)),
        });
    } else {
        throw new Error(`Invalid metadata type: ${metadataType}`);
    }

    console.log(`Processed ${event.type} for ${metadataType} subscription ${subscriptionId}`);
}

async function handleInvoicePaymentSucceeded(event: Stripe.Event, transaction: FirebaseFirestore.Transaction) {
    console.log("handleInvoicePaymentSucceeded", JSON.stringify(event, null, 2));
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
            await updateUserSubscriptionList(userId, subscriptionData, null, transaction);
            await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem, transaction);
            const userRef = adminDb.collection("users").doc(userId);
            transaction.update(userRef, { insightLookup: true });
        } else if (metadataType === "location") {
            const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
            if (!locationId || !userId) {
                throw new Error(`Location or user not found for subscription ${subscriptionId}`);
            }
            (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
            subscriptionItem.userId = userId;
            await updateLocationSubscriptionList(locationId, subscriptionData, null, userId, transaction);
            await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem, transaction);
            const locationRef = adminDb.collection("locations").doc(locationId);
            transaction.update(locationRef, { insightCertified: true });
        } else {
            throw new Error(`Invalid metadata type: ${metadataType}`);
        }

        console.log(`Processed invoice.payment_succeeded for ${metadataType} subscription ${subscriptionId}`);
    } catch (error) {
        console.error("Error handling invoice.payment_succeeded:", error);
        throw error;
    }
}

async function handleInvoicePaymentFailed(event: Stripe.Event, transaction: FirebaseFirestore.Transaction) {
    console.log("handleInvoicePaymentFailed", JSON.stringify(event, null, 2));
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoice.parent?.subscription_details?.subscription as string;


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
        await updateUserSubscriptionList(userId, subscriptionData, null, transaction);
        await addUserSubscriptionItem(userId, subscriptionItem as SubscriptionUserItem, transaction);
        const userRef = adminDb.collection("users").doc(userId);
        transaction.update(userRef, { insightLookup: subscription.status === "active" });
    } else if (metadataType === "location") {
        const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
        if (!locationId || !userId) {
            throw new Error(`Location or user not found for subscription ${subscriptionId}`);
        }
        (subscriptionItem as SubscriptionLocationItem).locationId = locationId;
        subscriptionItem.userId = userId;
        await updateLocationSubscriptionList(locationId, subscriptionData, null, userId, transaction);
        await addLocationSubscriptionItem(locationId, subscriptionItem as SubscriptionLocationItem, transaction);
        const locationRef = adminDb.collection("locations").doc(locationId);
        transaction.update(locationRef, { insightCertified: subscription.status === "active" });
    } else {
        throw new Error(`Invalid metadata type: ${metadataType}`);
    }

    console.log(`Processed invoice.payment_failed for ${metadataType} subscription ${subscriptionId}`);

}


async function handlePaymentIntentSucceeded(event: Stripe.Event, transaction: FirebaseFirestore.Transaction) {
    console.log("handlePaymentIntentSucceeded", JSON.stringify(event, null, 2));
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const subscriptionId = paymentIntent.metadata.subscription as string;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price.product"],
    });
    const item = subscription.items.data[0];
    const product = item.price.product as Stripe.Product;
    const metadataType = product.metadata.type;

    const subscriptionData: Partial<Subscription> = {
        id: subscriptionId,
    };

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
    const cardInfo : CardInfo = {
        cardId: paymentMethod.id,
        cardOwnerName: paymentMethod.billing_details?.name || "",
        cardBrand: paymentMethod.card?.brand || "",
        cardLast4: paymentMethod.card?.last4 || "",
        cardExpiry: paymentMethod.card?.exp_month && paymentMethod.card?.exp_year
            ? `${paymentMethod.card.exp_month}/${paymentMethod.card.exp_year}`
            : "",
    };

    if (metadataType === "user") {
        const userId = await getUserWithSubscription(subscriptionId);
        if (!userId) {
            throw new Error(`User not found for subscription ${subscriptionId}`);
        }
        await updateUserSubscriptionList(userId, subscriptionData, cardInfo, transaction);
    } else if (metadataType === "location") {
        const { userId, locationId } = await getLocationWithSubscription(subscriptionId);
        if (!locationId || !userId) {
            throw new Error(`Location or user not found for subscription ${subscriptionId}`);
        }
        await updateLocationSubscriptionList(locationId, { id: subscriptionId }, cardInfo, userId, transaction);
    }
}

async function updateUserSubscriptionList(
    userId: string,
    subscriptionData: Partial<Subscription>,
    cardInfo: CardInfo | null,
    transaction: FirebaseFirestore.Transaction
) {
    const subscriptionListRef = adminDb.collection("subscriptionUserList").doc(userId);
    const subscriptionListDoc = await transaction.get(subscriptionListRef);
    let subscriptionList: SubscriptionUserList = subscriptionListDoc.exists
        ? subscriptionListDoc.data() as SubscriptionUserList
        : {
            id: userId,
            subscriptions: [],
            cardInfo: { cardId: "", cardOwnerName: "", cardBrand: "", cardLast4: "", cardExpiry: "" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            payerUserId: userId,
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

    if (cardInfo) {
        subscriptionList.cardInfo = cardInfo;
    }
    subscriptionList.updatedAt = new Date().toISOString();
    transaction.set(subscriptionListRef, subscriptionList);
}

async function updateLocationSubscriptionList(
    locationId: string,
    subscriptionData: Partial<Subscription>,
    cardInfo: { cardId: string; cardOwnerName: string; cardBrand: string; cardLast4: string; cardExpiry: string } | null,
    payerUserId: string,
    transaction: FirebaseFirestore.Transaction
) {
    const subscriptionListRef = adminDb.collection("subscriptionLocationList").doc(locationId);
    const subscriptionListDoc = await transaction.get(subscriptionListRef);
    let subscriptionList: SubscriptionLocationList = subscriptionListDoc.exists
        ? subscriptionListDoc.data() as SubscriptionLocationList
        : {
            id: locationId,
            subscriptions: [],
            cardInfo: { cardId: "", cardOwnerName: "", cardBrand: "", cardLast4: "", cardExpiry: "" },
            payerUserId, // who paid for the subscription
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

    if (cardInfo) {
        subscriptionList.cardInfo = cardInfo;
    }
    subscriptionList.payerUserId = payerUserId;

    subscriptionList.updatedAt = new Date().toISOString();
    transaction.set(subscriptionListRef, subscriptionList);
}

async function addUserSubscriptionItem(userId: string, item: SubscriptionUserItem, transaction: FirebaseFirestore.Transaction) {
    const subscriptionItemRef = adminDb.collection("subscriptionUserItem").doc(item.id);
    transaction.set(subscriptionItemRef, item);
}

async function addLocationSubscriptionItem(locationId: string, item: SubscriptionLocationItem, transaction: FirebaseFirestore.Transaction) {
    const subscriptionItemRef = adminDb.collection("subscriptionLocationItem").doc(item.id);
    transaction.set(subscriptionItemRef, item);
}

async function getUserWithSubscription(subscriptionId: string) {
    if (!subscriptionId) {
        throw new Error("Subscription ID is required");
    }

    try {
        const userSnapshot = await adminDb.collection("subscriptionUserList").get()
        for (const userDoc of userSnapshot.docs) {
            const userData = userDoc.data() as SubscriptionUserList;
            if (userData.subscriptions.some(sub => sub.id === subscriptionId)) {
                return userData.payerUserId || null;
            }
        }
        return null;
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
        const locationSnapshot = await adminDb.collection("subscriptionLocationList").get();
        
        if (locationSnapshot.empty) {
            return { userId: null, locationId: null };
        }

        let userId = null;
        let locationId = null;
        for (const locationDoc of locationSnapshot.docs) {
            const locationData = locationDoc.data() as SubscriptionLocationList;
            if (locationData.subscriptions.some(sub => sub.id === subscriptionId)) {
                userId = locationData.payerUserId || null;
                locationId = locationDoc.id;
                break;
            }
        }

        return {
            userId: userId,
            locationId: locationId
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
