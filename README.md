# Cloudimart — University Grocery & Stationery Prototype

This repository contains a prototype web application that demonstrates how Cloudimart could support convenient purchasing of groceries and student-related items within the Mzuzu University community.

This top-level README explains the project, lists the major components, and points to per-folder READMEs for detailed setup and run instructions.

## Project Structure

- `cloudimart-backend/` — Laravel backend (APIs, order processing, validation, delivery logging)
- `cloudimart-frontend/` — Next.js frontend (product listing, categories, cart, checkout)

## Goals Covered

This prototype implements the interview requirements at a prototype level:

1. Product Listing, Categorisation and Shopping Cart
   - Products are organised into categories such as Stationery and Dairy.
   - Users can add products to a shopping cart and proceed to checkout.

2. Checkout Location Restriction
   - Checkout is restricted to orders originating from configured local locations around Mzuzu University (see backend README for the exact list).
   - The frontend performs client-side validation; backend performs authoritative validation before order acceptance.

3. Order Processing & Delivery
   - A unique Order ID is generated for each successful order.
   - Order IDs are stored and communicated to the customer (email/SMS hooks available; see backend README).
   - Delivery confirmation requires an Order ID and phone number; status is logged and confirmation is sent to the customer.

## Where to Start

1. Read the backend README: `cloudimart-backend/README.md` to get the Laravel server running (database, migrations, environment variables).
2. Read the frontend README: `cloudimart-frontend/README.md` to run the Next.js frontend locally and connect it to the backend.

## Notes & Assumptions

- The prototype purposefully keeps SMS/email delivery simple — the code includes hooks and configuration points to integrate third-party providers (Twilio, Mailgun, etc.).
- The Mzuzu-community location list is configurable in the backend; the README explains where to edit it.

## Next steps / Improvements

- Add E2E tests for checkout and delivery flow.
- Add production-ready SMS/email integration, queue workers, and logging/monitoring.
- Add role-based access for delivery personnel and admin order dashboards.

---
For detailed instructions see the READMEs in `cloudimart-backend/` and `cloudimart-frontend/`.
