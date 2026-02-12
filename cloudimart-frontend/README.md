# Cloudimart Frontend (Next.js)

This folder contains the Next.js frontend for the Cloudimart prototype. It provides product listing, category browse, cart, and checkout pages, and integrates with the Laravel backend for order creation and delivery confirmation.

## Prerequisites

- Node.js (16+ recommended) and npm (or yarn)
 
## Setup (Windows PowerShell)

1. From project frontend folder run:

```powershell
cd c:\Users\aRelic\Downloads\relic\cloudimart-project\cloudimart-frontend
npm install
```

2. Create `.env.local` with any configuration needed. At minimum you will want to set the backend API URL:

```text
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
# other variables as needed
```

3. Run the development server:

```powershell
npm run dev
```

The frontend will run on http://localhost:3000 by default.

## Key locations in the codebase

- `src/app/(store)/checkout/page.tsx` — Checkout page that performs location validation and finalizes orders (this is the active checkout used by the prototype).
- `src/app/components/` — UI components used to build product lists, cart, and checkout.
- `src/lib/` or `src/utils/` — API wrappers, helpers and client-side validation utilities.

## How the checkout location restriction works (frontend side)

- The checkout page validates the user's chosen delivery location against the list of supported locations before allowing submission. This provides immediate feedback.
- The backend performs authoritative validation when the order request reaches the server; the frontend validation helps the user earlier in the flow.

## Testing the prototype

1. Start the backend (see backend README).
2. Start the frontend with `npm run dev`.
3. Open the app, browse categories (Stationery, Dairy), add items to cart.
4. Proceed to checkout. When prompted for a delivery location, try both allowed locations (e.g., `Mzuzu University`) and a disallowed location to confirm the restriction.

## Notes on integration

- The frontend expects REST endpoints for product listing, cart, and checkout under the backend API base URL (see `NEXT_PUBLIC_API_URL`). If API paths differ, update the frontend API wrappers accordingly.
- Order confirmation and notifications are performed by the backend. The frontend displays the returned Order ID and stores it in the user session when available.

## Next steps / improvements

- Add E2E tests (Cypress or Playwright) to cover the full checkout and delivery confirmation flow.
- Improve UX for delivery personnel (mobile-friendly delivery confirmation form).

## Useful commands

```powershell
# Install
npm install

# Run dev
npm run dev

# Build for production
npm run build; npm run start
```
# Cloudimart Frontend — local dev notes

This folder contains the Next.js frontend for Cloudimart. Below are minimal steps to run it locally and the recommended way to configure the API URL.

Environment variable (recommended)
-------------------------------
- This project uses an environment variable named `NEXT_PUBLIC_API_URL` to point the frontend to your backend API (for example Laravel).
- Advantages: explicit, portable to deployments (Vercel / Netlify), and keeps code the same between environments.

How to use
----------
1. Copy the example env file and edit the URL to match your backend:

```bash
copy .env.example .env.local
# then edit .env.local and set NEXT_PUBLIC_API_URL
```

2. Install dependencies and run the dev server:

```powershell
cd cloudimart-frontend
npm install
npm run dev
# or use pnpm/yarn if you prefer
```

3. Open `http://localhost:3000` and navigate to Register / Login.

CORS note
---------
- If the backend runs on a different origin (for example `http://localhost:8000`), ensure your Laravel app allows requests from the Next origin (`http://localhost:3000`).
- Configure CORS in Laravel (e.g., `config/cors.php`) or by using the `fruitcake/laravel-cors` middleware.

Alternative: Next.js proxy
-------------------------
- You can use Next.js rewrites to proxy `/api/*` to your backend. This avoids CORS in development, but requires adding a `next.config.js` rewrite and careful deployment configuration. The env var approach is simpler and recommended.

Troubleshooting
---------------
- If requests return 401/403, confirm CSRF, CORS and auth flows on the backend.
- If you still see CORS issues, either add the frontend origin to the backend allowed origins or consider the rewrite/proxy approach.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
