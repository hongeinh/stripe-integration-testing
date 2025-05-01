<script>
    import { XCircle } from 'lucide-svelte';
  </script>
  
  <div class="flex flex-col justify-center items-center min-h-screen bg-red-50 text-center p-4">
    <XCircle class="w-16 h-16 text-red-500 mb-4" />
    <h1 class="text-3xl font-bold text-red-700">Payment Cancelled</h1>
    <p class="text-red-600 mt-2">Your payment was not completed. You can try again or return to the home page.</p>
    <a href="/" class="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
      Back to Home
    </a>
  </div>
  