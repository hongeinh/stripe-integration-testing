<script lang="ts">
    import { userHandler } from "$lib/store/userStore";
    import type { Subscription } from "$lib/type";
    export let subscriptions: Subscription[];
    export let userId: string;
    export let type: "user" | "location";

    const cancelSubscription = async (subscriptionId: string) => {
        await userHandler.cancelSubscription(userId, subscriptionId, type);
    };

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
                    >History</th
                >
                <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Actions</th
                >
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            {#each subscriptions as subscription}
                <tr>
                    <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                        >{subscription.name}</td
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
                        {formatDate(subscription.currentPeriodStart)}
                    </td>
                    <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                        {formatDate(subscription.currentPeriodEnd)}
                    </td>
                    <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                        <button class="text-blue-600 hover:text-blue-800">
                            View History
                        </button>
                    </td>
                    <td
                        class="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                    >
                        {#if subscription.status === "active"}
                            <button
                                on:click={() =>
                                    cancelSubscription(subscription.id)}
                                class="text-red-600 hover:text-red-800 font-medium"
                            >
                                Cancel
                            </button>
                        {/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>
