# Cloudimart — Mzuzu University Community Grocery & Stationery Prototype

This repository contains a prototype web application that demonstrates how Cloudimart could support convenient purchasing of groceries and student-related items within the Mzuzu University community.

This top-level README explains the project, lists the major components, and points to per-folder READMEs for detailed setup and run instructions.

## Project Structure

- `cloudimart-backend/` — Laravel backend (APIs, order processing, validation, delivery logging)
- `cloudimart-frontend/` — Next.js frontend (product listing, categories, cart, checkout)

## Tech stack

- Frontend: Next.js (App Router), React, Bootstrap-styled components.
- Backend: Laravel (Sanctum for auth), MySQL, Eloquent models.
- Storage: Laravel public disk for proofs and images.
- Optional integrations: SMS/email providers (Twilio, Mailgun, etc.) — hooks included.

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

4. Admin Tooling
   - Admin UI and API endpoints for payments review/approval/rejection, location management (CRUD), delivery assignment, and user management.
   - Payments can carry a `cart_snapshot` and `delivery_fee` in `meta` so admins can auto-create orders from proof-of-payment submissions.
   - Locations include `polygon_coordinates` (JSON), `delivery_fee`, `radius_km`, and other metadata to control checkout eligibility.

## Where to Start

1. Read the backend README: `cloudimart-backend/README.md` to get the Laravel server running (database, migrations, environment variables).
2. Read the frontend README: `cloudimart-frontend/README.md` to run the Next.js frontend locally and connect it to the backend.

## Important implementation notes

- Location validation: the backend validates delivery locations using either a stored list or polygon data. Edit allowed locations in the backend (or use the admin locations CRUD endpoints) to change which addresses are eligible.
- Payments & approval flow: payments may be created via gateway callbacks or by users uploading proof. Admins review proofs and can approve (auto-create order using `cart_snapshot`) or reject payments. Approval verifies stock and the expected amount (snapshot total + delivery fee).
- Admin locations model: the `locations` table supports:
  - `name`, `slug`, `type`, `latitude`, `longitude`, `radius_km`
  - `delivery_fee` (MK), `description`, `address`, `is_active`
  - `polygon_coordinates` (JSON) — optional free-form GeoJSON-style storage
- Frontend expectations: the frontend expects REST endpoints under `NEXT_PUBLIC_API_URL` (e.g., `/api/products`, `/api/admin/locations`). If you change backend routes, update `src/lib/api/client` wrappers accordingly.
- Auth & roles: Laravel Sanctum is used for authentication. Admin and delivery roles are used to control access to specific routes and UI elements.


## Notes & Assumptions
- The Mzuzu-community location list is configurable in the backend; the README explains where to edit it.

## Next steps / Improvements

- Add E2E tests for checkout and delivery flow.
- Add production-ready SMS/email integration, queue workers, and logging/monitoring.
- Add role-based access for delivery personnel and admin order dashboards.

For detailed instructions see the READMEs in `cloudimart-backend/` and `cloudimart-frontend/`.

Where to look in the code

Frontend

src/app/(store)/checkout/page.tsx — primary checkout flow and client-side location validation.

src/app/(admin)/admin/locations/page.tsx — admin UI for locations (list/create/edit/toggle/delete).

src/components/common/Header.tsx, src/components/common/AdminTabs.tsx — role-aware header and admin navigation.

Backend

app/Http/Controllers/Api/AdminController.php — admin endpoints (payments, locations, users, orders).

app/Services/LocationService.php — location validation logic used by checkout.

app/Traits/GeneratesOrderId.php — order id generation logic.

database/migrations/ — schema including locations migration and polygon storage.

Docs & utilities

docs/ — (if present) API reference, architecture notes, ERD and sequence diagrams.