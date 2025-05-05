<script lang="ts">
    import { auth } from '$lib/firebase';
    import { loginUser, registerUser } from '$lib/auth';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
  
    let email = '';
    let password = '';
    let isRegister = false;
    let error = '';
  
    async function handleSubmit() {
      error = '';
      try {
        if (isRegister) {
          const user = await registerUser(email, password);
          console.log('Registered:', user.uid);
        } else {
          const user = await loginUser(email, password);
          console.log('Logged in:', user.uid);
        }
        goto(`/user/${auth.currentUser?.uid}`);
      } catch (e) {
        error = (e as Error).message;
      }
    }
  </script>
  
  <h1 class="text-xl font-bold">{isRegister ? 'Register' : 'Login'}</h1>
  
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <input type="email" bind:value={email} placeholder="Email" required class="border p-2 w-full" />
    <input type="password" bind:value={password} placeholder="Password" required class="border p-2 w-full" />
  
    {#if error}
      <p class="text-red-600">{error}</p>
    {/if}
  
    <button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded">
      {isRegister ? 'Register' : 'Login'}
    </button>
  
    <button type="button" on:click={() => isRegister = !isRegister} class="text-sm text-blue-700 underline">
      {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
    </button>
  </form>
  