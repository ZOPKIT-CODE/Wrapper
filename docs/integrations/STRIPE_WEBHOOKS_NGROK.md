# Stripe webhooks with ngrok

Use ngrok to expose your local backend so Stripe can send webhook events (e.g. after checkout).

## 1. Fix 404 after payment (success URL)

Credit purchases were redirecting to `/billing/success`, which doesn’t exist. The backend now redirects to:

- **Success:** `{FRONTEND_URL}/payment-success?type=credit_purchase&session_id={CHECKOUT_SESSION_ID}`
- **Cancel:** `{FRONTEND_URL}/payment-cancelled?type=credit_purchase`

Ensure `FRONTEND_URL` is set (e.g. `http://localhost:3001`).

---

## 2. Run the backend

```bash
cd backend && npm run dev
```

Default port is **3000** (or `PORT` from env).

---

## 3. Run ngrok (expose backend)

In another terminal:

```bash
cd backend && npm run ngrok
```

Or, if ngrok is installed globally:

```bash
ngrok http 3000
```

Use your actual backend port if different (e.g. `ngrok http 4000`).

ngrok will print a public URL, e.g. `https://abc123.ngrok-free.app`.

---

## 4. Configure webhook in Stripe

1. **Stripe Dashboard** → **Developers** → **Webhooks** → **Add endpoint**.

2. **Endpoint URL** (replace `<ngrok-host>` with your ngrok URL, no trailing slash):
   - **Subscriptions / plan checkout:**  
     `https://<ngrok-host>/api/subscriptions/webhook`
   - **Credit purchases:**  
     `https://<ngrok-host>/api/credits/webhook`

   Example: `https://abc123.ngrok-free.app/api/subscriptions/webhook`

3. **Events to send:** e.g. `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed` (add what your app handles).

4. **Add endpoint** → copy the **Signing secret** (`whsec_...`).

5. In backend `.env` (or your env source):
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
   ```
   Restart the backend so it picks up the secret.

---

## 5. Webhook routes (reference)

| Purpose              | Method | URL (relative to backend base)   |
|----------------------|--------|-----------------------------------|
| Subscriptions/plans  | POST   | `/api/subscriptions/webhook`      |
| Credit purchases     | POST   | `/api/credits/webhook`            |

Full URL = `https://<ngrok-host><path>` (e.g. `https://abc123.ngrok-free.app/api/subscriptions/webhook`).

---

## 6. Test

1. Start backend and ngrok.
2. In Stripe Dashboard, open your webhook → **Send test webhook** (e.g. `checkout.session.completed`).
3. Check backend logs and Stripe’s webhook “Recent deliveries” for success/failure.

**Note:** Free ngrok URLs change each run. Update the endpoint URL in Stripe (or use a fixed ngrok domain if you have one) whenever the ngrok URL changes.
