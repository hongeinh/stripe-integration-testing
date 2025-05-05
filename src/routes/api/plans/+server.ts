import Stripe from 'stripe';
import { json } from '@sveltejs/kit';

const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil",
});

export const GET = async () => {
    const products = await stripe.products.list();
    const prices = await stripe.prices.list();

    const plans = products.data.map((product) => {
        const price = prices.data.find((price) => price.product === product.id);
        return {
            name: product.name,
            priceId: price?.id,
            description: price?.nickname,
            unit_amount: price?.unit_amount,
            currency: price?.currency,
            interval: price?.recurring?.interval,
        };
    });

    return json(plans);
}