<script lang="ts">
    import { onMount } from "svelte";
    import { auth } from "$lib/firebase";
    import { userStore, userHandler } from "$lib/store/userStore.js";
    import { goto } from "$app/navigation";

    export let data;
    let userId = data.userId;
    let isLoading = false;
    let subscriptionStatus = "inactive";
    let currentPeriodEnd;
    let isExpired = false;
    let isExpiringSoon = false;

    userStore.subscribe((store) => {
        isLoading = store.isLoading;

        if (store.currentUser) {
            subscriptionStatus = store.currentUser?.status || "inactive";
            currentPeriodEnd = store.currentUser?.currentPeriodEnd;

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
    });

    onMount(async () => {
        const user = auth.currentUser;
        if (!user || user.uid !== userId) {
            alert("You are not authorized to view this page.");
            goto("/login");
            return;
        }
        try {
            await userHandler.getUser(userId);
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
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
    <h1 class="text-2xl font-bold mb-4">Your subscription</h1>
    {#if isLoading}
        <p>Loading...</p>
    {:else if subscriptionStatus === "active"}
        <p>
            Your subscription is <strong class="text-green-600">active</strong>.
        </p>
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
    {:else if subscriptionStatus === "expired"}
        <p>
            Your subscription has <strong class="text-red-600">expired</strong>.
        </p>
        <button
            on:click={renewSubscription}
            class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
            Renew Subscription
        </button>
    {:else if subscriptionStatus === "canceled"}
        <p>Your subscription has been canceled.</p>
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
</div>
