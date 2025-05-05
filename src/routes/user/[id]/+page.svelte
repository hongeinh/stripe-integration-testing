<script lang="ts">
    import { page } from "$app/stores";
    import { db } from "$lib/firebase";
    import { doc, getDoc } from "firebase/firestore";
    import { onMount } from "svelte";

    let userId = "";
    let userData = { name: "", subscriptionId: "" };
    let notification = "";

    onMount(async () => {
        try {
            userId = $page.params.id;
            const docRef = doc(db, "users", userId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                userData = docSnap.data();
            }

            const status = new URL(window.location.href).searchParams.get(
                "status",
            );
            if (status === "success") {
                notification = "✅ Subscription successful!";
            } else if (status === "cancel") {
                notification = "❌ Subscription cancelled or failed.";
            }
        } catch (error) {
            console.log("Subscription page error:", error);
        }
    });
</script>

<h1 class="text-xl font-bold mb-2">User Detail</h1>
<p><strong>Name:</strong> {userData.name}</p>
<p><strong>Subscription ID:</strong> {userData.subscriptionId || "None"}</p>

{#if notification}
    <div class="mt-4 p-2 bg-green-100 border border-green-500 rounded">
        {notification}
    </div>
{/if}
