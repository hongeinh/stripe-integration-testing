<script lang="ts">
  import { auth } from "$lib/firebase";
  import { onAuthStateChanged } from "firebase/auth";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { userHandler } from "$lib/store/userStore";

  let plans = [];
  let selectedPlan;
  let promoCode = "";

  onMount(async () => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        goto(`/login`);
        return;
      }
    });
    const res = await fetch("/api/plans");
    plans = await res.json();
    console.log("plans", plans);
    selectedPlan = plans[0];
  });

  async function subscribe() {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        goto(`/login`);
        return;
      }
      const url = await userHandler.subscribe(userId, selectedPlan.priceId, promoCode.trim());
      window.location.href = url;
    } catch (error) {
      console.error("Subscription failed:", error);
    }
  }

  async function test() {
    const userId = auth.currentUser?.uid;
    const res = await fetch("/api/test", {
      method: "POST",
      body: JSON.stringify({
        userId: "test",
        priceId: "price_1N9968Hq77t28L10Q0p6v36m",
        promoCode: "test",
      }),
    });
  }
</script>

<div class="max-w-md mx-auto mt-8 p-4 bg-white shadow-md rounded-lg">
  <h1 class="text-2xl font-bold mb-4">Choose a Subscription Plan</h1>
  <div class="flex flex-col space-y-4">
    {#if plans.length}
      <select bind:value={selectedPlan}>
        {#each plans as plan}
          <option value={plan}>
            {plan.name} - {plan.unit_amount / 100}
            {plan.currency.toUpperCase()}
          </option>
        {/each}
      </select>
      <div class="mb-4">
        <label for="promo" class="block text-sm font-medium text-gray-700"
          >Promo Code</label
        >
        <input
          id="promo"
          type="text"
          bind:value={promoCode}
          placeholder="Enter promo code"
          class="border border-gray-300 rounded-md p-2 w-full"
        />
      </div>
      <button
        on:click={subscribe}
        class="bg-blue-600 text-white px-4 py-2 rounded mt-2">Subscribe</button
      >
      <button>Test</button>
    {:else}
      <p>Loading plans...</p>
    {/if}
  </div>
</div>
