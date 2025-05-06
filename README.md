# TODO
- [ ] Add detail to user subscription description: subscription name, start, end, price, status.


# Stripe Integration
1. Create a Stripe account and get your API keys.
2. Create products in Product catalog.
3. Create promo code in Product catalog > Coupon.
4. Create a webhook in Developer > Webhooks. Register the webhook URL (must be https) and the events you want to listen to.
5. Create a .env file in the root directory and add your Stripe API keys.

```bash
VITE_STRIPE_SECRET_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_WEBHOOK_SECRET=
```  
6. In test mode, install stripe CLI and run the following command to listen to the webhook:
For stripe to listen to the webhook:
```bash
stripe login
# stripe listen --forward-to localhost:5173/api/webhook
stripe listen --events payment_intent.created,customer.created,payment_intent.succeeded,checkout.session.completed,payment_intent.payment_failed --forward-to localhost:5173/api/webhook
```