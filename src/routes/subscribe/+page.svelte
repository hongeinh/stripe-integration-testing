<script>
import { plans } from '$lib/data/plans';

let selectedPlan = plans[0];

async function checkout() {
    const res = await fetch('/api/subscribe', {
        method: 'POST',
        body: JSON.stringify({
            userId: 'u1',
            priceId: selectedPlan.stripePriceId,
        })
    });

    const { url } = await res.json();
    window.location.href = url;
}
</script>

<h1 class="text-2xl font-bold mb-4">Choose a Subscription Plan</h1>
<select bind:value={selectedPlan} class="border border-gray-300 rounded-md p-2 mb-4">
    {#each plans as plan}
        <option value={plan}>{plan.name} - {plan.description} - 1 month</option>
    {/each}
</select>

<button onclick={checkout} class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
    Checkout
</button>