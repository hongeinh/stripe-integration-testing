<script lang="ts">
    import { onMount } from "svelte";
    import { auth } from "$lib/firebase";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { userStore, userHandler } from "$lib/store/userStore.js";
    import SubscriptionList from "$lib/components/SubscriptionList.svelte";
    import type {
        SubscriptionUserList,
        SubscriptionLocationList,
        Company,
        Location,
        User,
    } from "$lib/type";
    import { companyHandler } from "$lib/store/companyStore";
    import { locationHandler } from "$lib/store/locationStore";

    export let data: { id: string };

    let userId = data.id;
    let user: User | null = null;
    let isLoading = false;
    let userSubscriptionList: SubscriptionUserList | null = null;
    let locationSubscriptionList: SubscriptionLocationList | null = null;
    let company: Company | null = null;
    let currentLocationId: string | null = null;
    let currentLocationName: string | null = null;
    let locations: Location[] | null = null;
    let isAuthLoading = true;
    let paymentStatus = "";

    $: queryStatus = $page.url.searchParams.get("status");

    userStore.subscribe(async (store) => {
        isLoading = store.isLoading;

        if (store.currentUser) {
            user = store.currentUser;
            userSubscriptionList = store.userSubscriptions;
            locationSubscriptionList = store.locationSubscriptions;

            locations = await locationHandler.getLocations(user.companyId);
            company = await companyHandler.getCompany(user.companyId);
            currentLocationId = user.currentLocationId;
            currentLocationName = locations?.find(location => location.id === currentLocationId)?.name ?? null;
        }
    });

    onMount(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            isAuthLoading = false;
            if (!user) {
                alert("You are not authorized to view this page.");
                goto("/login");
                return;
            }

            if (!userId) {
                alert("Invalid user ID.");
                goto("/login");
                return;
            }

            if (user.uid !== userId) {
                alert(
                    "Unauthorized: You cannot view another user's subscription.",
                );
                goto("/login");
                return;
            }

            try {
                await userHandler.getUser(userId);
                if (queryStatus === "success") {
                    paymentStatus = "Payment successful.";
                } else if (queryStatus === "cancel") {
                    paymentStatus = "Payment canceled.";
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                paymentStatus = "Error loading subscription data.";
            }
        });

        return () => unsubscribe();
    });

    async function handleLocationChange() {
        try {
            await userHandler.changeEmployeeLocation(
                user?.currentLocationId ?? "",
                userId,
                currentLocationId ?? "",
            );
            alert("Location updated successfully.");
        } catch (error) {
            console.error("Error updating location:", error);
            alert("Error updating location. Please try again.");
        }
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

    <div class="flex flex-col gap-2 items-start mb-6">
        <h1 class="text-2xl font-bold">User Information</h1>
        <p><strong>Name:</strong> {user?.name ?? "Loading..."}</p>
        <p><strong>Company:</strong> {company?.name ?? "Loading..."}</p>
        <div class="flex items-center gap-2">
            <p><strong>Current Location:</strong></p>
            {#if locations && locations.length > 0}
                <select
                    bind:value={currentLocationId}
                    class="w-64 border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                    {#each locations as location}
                        <option
                            value={location.id}
                            selected={location.id === currentLocationId}
                            class={location.id === user?.currentLocationId
                                ? "bg-blue-100 font-semibold p-4"
                                : "bg-white"}>{location.name}</option
                        >
                    {/each}
                </select>
                <button
                    on:click={handleLocationChange}
                    class="bg-blue-500 text-white px-4 py-1 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    disabled={!currentLocationId}
                >
                    Change Location
                </button>
            {:else}
                <p>No locations available</p>
            {/if}
        </div>
    </div>

    <div class="flex flex-col gap-8 items-center">
        <h2 class="text-xl font-semibold mb-4 text-center">
            User Subscriptions
        </h2>
        {#if userSubscriptionList?.subscriptions.length}
            <SubscriptionList
                subscriptions={userSubscriptionList.subscriptions}
                {userId}
                type="user"
            />
        {:else}
            <p class="text-center text-gray-500">
                No user subscriptions found.
            </p>
        {/if}

        <h2 class="text-xl font-semibold mb-4 text-center">
            Location Subscriptions
        </h2>
        {#if locationSubscriptionList?.subscriptions.length}
            <SubscriptionList
                subscriptions={locationSubscriptionList.subscriptions}
                {userId}
                type="location"
            />
        {:else}
            <p class="text-center text-gray-500">
                No location subscriptions found.
            </p>
        {/if}

        {#if paymentStatus}
            <p class="text-center text-red-500">{paymentStatus}</p>
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
</style>
