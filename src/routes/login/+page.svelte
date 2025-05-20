<script lang="ts">
  //@ts-nocheck
  import { auth } from "$lib/firebase";
  import { loginUser, registerUser } from "$lib/auth";
  import { goto } from "$app/navigation";
  import { doc, setDoc } from "firebase/firestore";
  import { db } from "$lib/firebase";
  import { onMount } from "svelte";

  let email = "";
  let password = "";
  let isRegister = false;
  let error = "";

  async function createUser(user) {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      email: user.email,
      uid: user.uid,
      createdAt: new Date().toISOString(),
      status: "inactive",
    });
  }

  async function handleSubmit() {
    error = "";
    try {
      let user;
      if (isRegister) {
        user = await registerUser(email, password);
        await createUser(user);
      } else {
        user = await loginUser(email, password);
      }
      // Wait for auth state to update
      const unsubscribe = auth.onAuthStateChanged((authUser) => {
        if (authUser) {
          goto(`/user/${authUser.uid}`);
          unsubscribe();
        }
      });
    } catch (e) {
      error = (e as Error).message;
      console.error("Auth error:", error);
    }
  }

  onMount(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        goto(`/user/${user.uid}`);
      }
    });
    return () => unsubscribe();
  });
</script>

<div
  class="max-w-md mx-auto mt-8 p-4 bg-white shadow-md rounded-lg flex flex-col items-center"
>
  <h1 class="text-xl font-bold">{isRegister ? "Register" : "Login"}</h1>

  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <input
      type="email"
      bind:value={email}
      placeholder="Email"
      required
      class="border p-2 w-full rounded"
    />
    <input
      type="password"
      bind:value={password}
      placeholder="Password"
      required
      class="border p-2 w-full rounded"
    />

    {#if error}
      <p class="text-red-600">{error}</p>
    {/if}

    <div class="flex justify-between">
      <button
        type="button"
        on:click={() => (isRegister = !isRegister)}
        class="text-sm text-blue-700 underline"
      >
        {isRegister
          ? "Already have an account? Login"
          : "Don't have an account? Register"}
      </button>

      <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">
        {isRegister ? "Register" : "Login"}
      </button>
    </div>
  </form>
</div>
