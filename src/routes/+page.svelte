<script lang="ts">
  import { auth } from "$lib/firebase";
  import { onAuthStateChanged } from "firebase/auth";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  let plans = [];
  let selectedPlan;

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
  });

  async function subscribe() {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        goto(`/login`);
        return;
      }
      const res = await fetch("/api/subscribe", {
        method: "POST",
        body: JSON.stringify({
          userId,
          priceId: selectedPlan.priceId,
        }),
      });
      const { url } = await res.json();
      window.location.href = url;
    } catch (error) {
      console.error("Subscription failed:", error);
    }
  }
</script>

<h1 class="text-2xl font-bold mb-4">Choose a Subscription Plan</h1>
{#if plans.length}
  <select bind:value={selectedPlan}>
    {#each plans as plan}
      <option value={plan}>
        {plan.name} - {plan.unit_amount / 100}
        {plan.currency.toUpperCase()}
      </option>
    {/each}
  </select>
  <button
    on:click={subscribe}
    class="bg-blue-600 text-white px-4 py-2 rounded mt-2">Subscribe</button
  >
{:else}
  <p>Loading plans...</p>
{/if}
