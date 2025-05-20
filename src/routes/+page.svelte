<script lang="ts">
  import { auth } from "$lib/firebase";
  import { onAuthStateChanged } from "firebase/auth";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { userHandler, userStore } from "$lib/store/userStore";

  interface Plan {
    id: string;
    name: string;
    description: string;
    interval: string;
    priceId: string;
    unit_amount: number;
    currency: string;
  }

  let plans: Plan[] = [];
  let selectedPlan: Plan | null = null;
  let promoCode = "";
  let currentUserId: string = "";
  let currentLocationId: string = "";
  let userId: string | null = null;

  onMount(async () => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        goto(`/login`);
        return;
      }
    });
    const res = await fetch("/api/plans");
    plans = await res.json();
    selectedPlan = plans[0];
    await userHandler.getUser(auth.currentUser?.uid ?? "");
  });

  userStore.subscribe(async (store) => {
    currentUserId = store.currentUser?.id ?? "";
    currentLocationId = store.currentUser?.currentLocationId ?? "";
  });

  async function subscribe() {
    try {
      if (!selectedPlan) {
        alert("Please select a plan first");
        return;
      }
      const url = await userHandler.subscribe(
        currentUserId,
        currentLocationId,
        selectedPlan.priceId,
        promoCode.trim(),
      );
      window.location.href = url;
    } catch (error) {
      alert("Subscription failed: " + (error as Error).message);
    }
  }
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-3xl font-bold">Choose a Subscription Plan</h1>
    {#if currentUserId}
      <button
        on:click={() => goto(`/user/${currentUserId}`)}
        class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
      >
        View My Subscriptions
      </button>
    {/if}
  </div>

  <div
    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
  >
    {#each plans as plan}
      <div
        class="bg-white rounded-lg shadow-lg p-6 cursor-pointer transition-transform hover:scale-105 {selectedPlan?.priceId ===
        plan.priceId
          ? 'ring-2 ring-blue-500'
          : ''}"
        on:click={() => (selectedPlan = plan)}
      >
        <h2 class="text-2xl font-bold text-center mb-4">{plan.name}</h2>
        <div class="text-center text-3xl font-semibold text-gray-800">
          {plan.unit_amount / 100}
          {plan.currency.toUpperCase()}
        </div>
      </div>
    {/each}
  </div>

  <div class="max-w-md mx-auto mt-8 space-y-4">
    <div class="bg-white rounded-lg shadow p-6">
      <label for="promo" class="block text-sm font-medium text-gray-700 mb-2">
        Promo Code
      </label>
      <input
        id="promo"
        type="text"
        bind:value={promoCode}
        placeholder="Enter promo code"
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </div>

    <button
      on:click={subscribe}
      class="w-full bg-blue-600 text-white px-6 py-3 rounded-md text-lg font-semibold hover:bg-blue-700 transition-colors"
    >
      Subscribe Now
    </button>
  </div>
</div>
