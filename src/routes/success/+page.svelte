<script>
    import { CheckCircle } from 'lucide-svelte';
  </script>
  
  <div class="flex flex-col justify-center items-center min-h-screen bg-green-50 text-center p-4">
    <CheckCircle class="w-16 h-16 text-green-500 mb-4" />
    <h1 class="text-3xl font-bold text-green-700">Payment Successful!</h1>
    <p class="text-green-600 mt-2">Thank you for your purchase. A confirmation has been sent to your email.</p>
    <a href="/" class="mt-6 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
      Back to Home
    </a>
  </div>
  