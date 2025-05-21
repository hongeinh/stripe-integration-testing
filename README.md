# STRIPE INTEGRATION WITH SVELTE, FIREBASE
## Stripe core concepts
1. Product:
* Something u sell: product = subscription plan
* Example: Basic, Business, Enterprise plans

2. Price:
* Defines how much and how often a customer is charged
* For subscriptions, prices are recurring (per month)
* Price is attached to a product.
* Example: Business - $10/month

3. Subscription:
* When a customer agrees to pay for a price regularly
* Stripe manages the subscription, charging the customer automatically and tracking its status (e.g., active, canceled)
* Example: A customer subscribes to the "Basic Plan" for $10/month, and Stripe bills them every month.

## Set up Stripe
1. Set up Products
2. Get Webhook secret: Go to developer mode -> Webhooks.
- On production mode: Add destination
- On development mode: Add local listener (follow given instructions)


## Firestore
### Rules
```
rules_version = '2';
service cloud.firestore {
    match /databases/{database}/documents {
        match /users/{userId} {
            allow read, write: if request.auth != null && request.auth.uid == userId;
        }
        match /users/{userId}/subscriptions/{subscriptionId} {
            allow read, write: if request.auth != null && request.auth.uid == userId;
            allow write: if request.auth == null; // Allow webhook
        }
    }
}
```

### Collections
```
users/{userId}
  - id: string
  - email: string
  - name: string
  - phone?: string
  - avatarUrl?: string
  - createdAt: string
  - updatedAt: string

users/{userId}/subscriptions/{userId}
  - id: string
  - userId: string
  - subscriptionId: string
  - subscriptionName: string
  - priceId: string
  - priceAmount: number
  - currency: string
  - status: string
  - currentPeriodStart: string
  - currentPeriodEnd: string
  - promoCode?: string | null
  - createdAt: string
  - updatedAt: string

users/{userId}/subscriptionHistory/{historyId}
  - id: string
  - subscriptionId: string
  - priceId: string
  - priceAmount: number
  - currency: string
  - promoCode?: string | null
  - paid: boolean
  - createdAt: string
```

## Setup project
1. Install dependencies
```bash
npm install
```
2. Get Stripe webhook secret
```bash
stripe login # then copy the webhook secret
```
3. Create a .env file in the root directory and add your Stripe API keys.
```bash
VITE_STRIPE_SECRET_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_WEBHOOK_SECRET=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_PRIVATE_KEY=
VITE_FIREBASE_CLIENT_EMAIL=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

4. (Test mode) Turn on Stripe webhook listener
```bash
stripe listen --events payment_intent.created,customer.created,payment_intent.succeeded,checkout.session.completed,payment_intent.payment_failed,customer.subscription.deleted,invoice.payment_succeeded,invoice.payment_failed,customer.subscription.updated --forward-to localhost:5173/api/webhook
```

5. Run the development server:
```bash
npm run dev
```

Stripe test card visa: 4242424242424242


# TODO
- [ ] Add detail to user subscription description: subscription name, start, end, price, status.



