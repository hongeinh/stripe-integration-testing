<script lang="ts">
    import { subscriptionHandlers } from "$lib/store/subscriptionStore";
    import { onMount } from "svelte";
    import type {
        SubscriptionUserItem,
        SubscriptionLocationItem,
    } from "$lib/type";
    import type { PageData } from "./$types";
    import { goto } from "$app/navigation";

    export let data: PageData;

    // Get the parameters from the load function
    $: ({ userId, subscriptionType, subscriptionId } = data);

    let subscriptionItems:
        | SubscriptionUserItem[]
        | SubscriptionLocationItem[]
        | null = null;

    onMount(async () => {
        subscriptionItems =
            subscriptionType === "user"
                ? await subscriptionHandlers.getSubscriptionUserItems(
                      userId,
                      subscriptionId,
                  )
                : await subscriptionHandlers.getSubscriptionLocationItems(
                      userId,
                      subscriptionId,
                  );
    });

    function formatDate(dateString: string) {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    function formatCurrency(amount: number, currency: string) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(amount / 100);
    }
</script>

<div class="relative min-h-screen p-6">
    <div class="flex justify-between items-center mb-8">
        <div></div>
        <button
            on:click={() => goto("/")}
            class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
        >
            Go to Home
        </button>
    </div>

    <div class="flex flex-col gap-8 items-center">
        <h2 class="text-xl font-semibold mb-4 text-center">
            Subscription History
        </h2>
        {#if subscriptionItems?.length && subscriptionItems.length > 0}
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white border border-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Name</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Status</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Total</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Period Start</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Period End</th
                            >
                            <th
                                class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                >Invoice</th
                            >
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {#each subscriptionItems as subscription}
                            <tr>
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                    >{subscription.subscriptionName}</td
                                >
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span
                                        class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                                    {subscription.status === 'active'
                                            ? 'bg-green-100 text-green-800'
                                            : subscription.status === 'canceled'
                                              ? 'bg-red-100 text-red-800'
                                              : 'bg-yellow-100 text-yellow-800'}"
                                    >
                                        {subscription.status}
                                    </span>
                                </td>
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                    {formatCurrency(
                                        subscription.amountTotal,
                                        subscription.currency,
                                    )}
                                </td>
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                    {formatDate(
                                        subscription.currentPeriodStart,
                                    )}
                                </td>
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                    {formatDate(subscription.currentPeriodEnd)}
                                </td>
                                <td
                                    class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                                >
                                    <button
                                        class="text-blue-600 hover:text-blue-800"
                                        on:click={() => {
                                            window.open(
                                                subscription.invoiceLink,
                                                "_blank",
                                            );
                                        }}
                                    >
                                        View Invoice
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {:else}
            <p class="text-center text-gray-500">
                No subscription history found.
            </p>
        {/if}
    </div>
</div>

<style>
    table {
        border-collapse: collapse;
        width: 100%;
    }
    th,
    td {
        padding: 8px;
        text-align: center;
        border: 1px solid #ddd;
    }
    th {
        background-color: #f4f4f4;
        font-weight: bold;
    }
    .subscription-details {
        padding: 1rem;
    }
    .params-info {
        background: #f5f5f5;
        padding: 1rem;
        border-radius: 4px;
        margin: 1rem 0;
    }
</style>
