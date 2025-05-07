<script lang="ts">
    import { onMount } from "svelte";
    import { auth } from "$lib/firebase";
    import { userStore, userHandler } from "$lib/store/userStore.js";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import type { UserSubscription, SubscriptionHistory } from "$lib/type";

    export let data: { id: string };

    let userId = data.id;
    let isLoading = false;
    let subscriptionStatus = "inactive";
    let currentPeriodEnd: string | null = null;
    let currentPeriodStart: string | null = null;
    let isExpired = false;
    let isExpiringSoon = false;
    let subscriptionName = "";
    let priceId = "";
    let paymentStatus = "";
    let isAuthLoading = true;
    let subscriptionHistory: SubscriptionHistory[] = [];

    $: queryStatus = $page.url.searchParams.get("status");
    $: queryPriceId = $page.url.searchParams.get("priceId");

    userStore.subscribe((store) => {
        isLoading = store.isLoading;

        if (store.currentUser && store.subscription) {
            subscriptionStatus = store.subscription?.status || "inactive";
            currentPeriodEnd = store.subscription?.currentPeriodEnd;
            currentPeriodStart = store.subscription?.currentPeriodStart;
            subscriptionName = store.subscription?.subscriptionName || "";
            priceId = store.subscription?.priceId || "";

            if (currentPeriodEnd) {
                const endDate = new Date(currentPeriodEnd);
                const now = new Date();
                const oneWeekFromNow = new Date(
                    now.getTime() + 7 * 24 * 60 * 60 * 1000,
                );

                isExpired = endDate < now;
                isExpiringSoon = endDate > now && endDate < oneWeekFromNow;

                if (isExpired) {
                    subscriptionStatus = "expired";
                }
            }
        }
        subscriptionHistory = store?.subscriptionHistory || [];
    });

    onMount(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            isAuthLoading = false; // Auth state resolved
            if (!user) {
                console.log("User is not authenticated.");
                alert("You are not authorized to view this page.");
                goto("/login");
                return;
            }

            if (!userId) {
                console.error("Error: userId is undefined", { data });
                alert("Invalid user ID.");
                goto("/login");
                return;
            }

            if (user.uid !== userId) {
                console.log("Unauthorized: UID mismatch", {
                    userUid: user.uid,
                    userId,
                });
                alert(
                    "Unauthorized: You cannot view another user's subscription.",
                );
                goto("/login");
                return;
            }

            try {
                console.log("Fetching user data for:", { userId });
                await userHandler.getUser(userId);
                // Set payment status based on query params
                if (queryStatus === "success") {
                    if (subscriptionStatus === "active") {
                        paymentStatus =
                            "Payment successful! Your subscription is now active.";
                    } else {
                        paymentStatus =
                            "Payment successful, but subscription is still processing. Please refresh or check back later.";
                    }
                } else if (queryStatus === "cancel") {
                    paymentStatus = "Payment canceled.";
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                paymentStatus = "Error loading subscription data.";
            }
        });

        return () => unsubscribe();
    });

    async function cancelSubscription() {
        if (confirm("Are you sure you want to cancel your subscription?")) {
            try {
                await userHandler.cancelSubscription(userId);
                alert("Subscription canceled successfully.");
            } catch (error) {
                console.error("Error canceling subscription:", error);
                alert("Error canceling subscription. Please try again.");
            }
        }
    }

    async function renewSubscription() {
        goto(`/`);
    }
</script>

<div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">Your Subscription</h1>
    {#if paymentStatus}
        <p
            class="{queryStatus === 'success'
                ? 'text-green-600'
                : 'text-red-600'} mb-4"
        >
            {paymentStatus}
        </p>
    {/if}
    {#if isLoading || isAuthLoading}
        <p>Loading...</p>
    {:else if subscriptionStatus === "active"}
        <p>Your subscription ({subscriptionName}) is active.</p>
        {#if currentPeriodStart}
            <p>
                Starts on: {new Date(currentPeriodStart).toLocaleDateString()}
            </p>
        {/if}
        {#if currentPeriodEnd}
            <p>Expires on: {new Date(currentPeriodEnd).toLocaleDateString()}</p>
            {#if isExpiringSoon}
                <p class="text-yellow-600">
                    Your subscription is expiring soon! Please renew or cancel.
                </p>
                <button
                    on:click={renewSubscription}
                    class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-2"
                >
                    Renew Subscription
                </button>
                <button
                    on:click={cancelSubscription}
                    class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                    Cancel Subscription
                </button>
            {/if}
        {/if}
    {:else if subscriptionStatus === "expired"}
        <p class="text-red-600">
            Your subscription ({subscriptionName}) has expired.
        </p>
        <button
            on:click={renewSubscription}
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
            Renew Subscription
        </button>
    {:else if subscriptionStatus === "canceled"}
        <p>Your subscription ({subscriptionName}) has been canceled.</p>
        <button
            on:click={renewSubscription}
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
            Resubscribe
        </button>
    {:else}
        <p>No active subscription.</p>
        <button
            on:click={renewSubscription}
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
            Subscribe
        </button>
    {/if}

    <h2 class="text-xl font-bold mt-8 mb-4">Subscription History</h2>
    {#if subscriptionHistory.length > 0}
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white border">
                <thead>
                    <tr>
                        <th class="py-2 px-4 border-b">Subscription Name</th>
                        <th class="py-2 px-4 border-b">Status</th>
                        <th class="py-2 px-4 border-b">Start Date</th>
                        <th class="py-2 px-4 border-b">End Date</th>
                        <th class="py-2 px-4 border-b">Created At</th>
                    </tr>
                </thead>
                <tbody>
                    {#each subscriptionHistory as sub}
                        <tr>
                            <td class="py-2 px-4 border-b"
                                >{sub.subscriptionName || "N/A"}</td
                            >
                            <td class="py-2 px-4 border-b">{sub.paid ? "Paid": "Unpaid"}</td>
                            <td class="py-2 px-4 border-b">
                                {sub.periodStart
                                    ? new Date(
                                          sub.periodStart,
                                      ).toLocaleDateString()
                                    : "N/A"}
                            </td>
                            <td class="py-2 px-4 border-b">
                                {sub.periodEnd
                                    ? new Date(
                                          sub.periodEnd,
                                      ).toLocaleDateString()
                                    : "N/A"}
                            </td>
                            <td class="py-2 px-4 border-b">
                                {new Date(sub.createdAt).toLocaleDateString()}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {:else}
        <p>No subscription history available.</p>
    {/if}
</div>

<style>
    table {
        border-collapse: collapse;
    }
    th,
    td {
        text-align: left;
    }
</style>
