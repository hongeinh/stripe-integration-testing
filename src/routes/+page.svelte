<script>
    async function checkout() {
        const res = await fetch('/api/checkout', {
            method: 'POST',
        });

        const { url } = await res.json();
        window.location.href = url;
    }
</script>

<div class="flex justify-center items-center h-screen">
    <button on:click={checkout}>Checkout</button>
</div>