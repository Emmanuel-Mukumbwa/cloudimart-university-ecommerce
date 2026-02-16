# Cloudimart API — Reference (Authoritative)

This reference is about the implemented route declarations and controller code in `cloudimart-backend`. It documents the API endpoints, HTTP methods, authentication requirements, validation rules, and typical request/response shapes that are actually implemented by the current codebase — not assumptions.

Use this file as the primary source of truth when integrating the frontend, writing tests, or building third‑party clients. If you discover a mismatch between runtime behavior and this documentation, please open an issue and include the failing request and the related controller (see `cloudimart-backend/routes/api.php` and `app/Http/Controllers/Api`).

Base URL (local dev):

  http://127.0.0.1:8000/api

Run the backend from the project root:

```powershell
cd cloudimart-backend; php artisan serve --host=127.0.0.1 --port=8000
```

Authentication
-------------
- The API uses Laravel Sanctum for authentication. Protected routes require `Authorization: Bearer <token>` (the controllers create plainTextToken on login/register).
- Login: `POST /api/auth/login` → returns `token` / `access_token`. Use it as `Authorization: Bearer <token>`.

Common headers
--------------
- Content-Type: application/json
- Accept: application/json
- Authorization: Bearer <token> (when required)

Public routes (no auth required)
-------------------------------
Note: these are implemented in `routes/api.php`.

Locations
- GET /api/locations
  - Returns: active locations (fields: id, name, latitude, longitude, radius_km, delivery_fee)

- GET /api/locations/{id}
  - Returns single location object or 404.

- POST /api/locations/validate-public
  - Body: { lat: number, lng: number, location_id?: number, cart_hash?: string, delivery_address?: string }
  - Throttled (10/min). Mirrors `validatePoint` implementation used also for auth-protected verification.

Auth
- POST /api/auth/register
  - Body (required): { name, email, password, password_confirmation, location_id }
  - Optional: phone_number, latitude, longitude
  - Response: { success, user, token, access_token }

- POST /api/auth/login
  - Body: { email, password }
  - Response: { success, user, token, access_token }

Products & Categories (public)
- GET /api/categories
  - Returns list of categories: { success, data: [ { id, name, slug, type } ] }

- GET /api/products
  - Query params: q (search), category (slug or id), per_page (default 12)
  - Returns paginated ProductResource collection (with category). See `ProductController@index`.

- GET /api/products/{id}
  - Returns `ProductResource` for the given id; 404 if not found.

Protected routes (require Authorization: Bearer)
------------------------------------------------
These routes are grouped under `auth:sanctum` in `routes/api.php`.

User
- GET /api/user
  - Returns the authenticated user object (from Request->user()).

- POST /api/auth/logout
  - Revokes the current token; returns { success, message }.

Cart
- GET /api/cart
  - Returns: { success, data: { cart, items } }

- POST /api/cart/add
  - Body: { product_id: integer (exists), quantity: integer >=1 }
  - Behavior: server checks stock and pending payments; merges quantities if item already present. Returns cart_item info.

- PUT /api/cart/item/{id}
  - Body: { quantity: integer >=1 }
  - Updates the cart item (requires item ownership). Returns updated item.

- DELETE /api/cart/item/{id}
  - Removes the item (requires ownership).

- POST /api/cart/item/{id}/decrement
  - Decrements quantity by 1 (or deletes the item if quantity becomes 0).

- GET /api/cart/count
  - Returns a count of items (CartController::count route exists in routes file).

Payments
- POST /api/payment/initiate
  - Body: { amount: numeric, mobile: string, network: string, delivery_lat?: number, delivery_lng?: number, delivery_address?: string, cart_hash?: string, location_id?: integer }
  - Behavior: server computes authoritative cart total + delivery_fee, creates a Payment (status 'pending') and calls PayChangu. Response: { checkout_url, tx_ref, payment }

- GET /api/payment/status?tx_ref=...
  - Query: tx_ref required. Returns payment status and normalized payment object.

- POST /api/payment/upload-proof
  - Form-data: file (image), amount, mobile, network, optional delivery_lat, delivery_lng, delivery_address, note, cart_hash, location_id
  - Stores proof, creates Payment with status 'pending' and meta including cart_snapshot. Returns { tx_ref, payment }

- GET /api/payments
  - Query params supported: cart_hash, tx_ref, exclude_ordered=1, only_pending=1
  - Returns list of payments for authenticated user (normalized with proof_url_full and decoded meta).

Checkout & Orders
- POST /api/checkout/validate-location
  - Body: { lat: number, lng: number }
  - Returns: { success, valid: boolean }

- POST /api/checkout/place-order
  - Body: { tx_ref: string, delivery_lat: number, delivery_lng: number, delivery_address: string, payment_method?: string, location_id?: integer }
  - Behavior: Idempotent on payment tx_ref. Validates payment exists and status == 'success', checks stock under row locks, creates Order + OrderItems + Delivery, clears cart if successful. Returns { success, order_id, order }.

- POST /api/orders (alias to placeOrder)

- GET /api/orders
  - Returns paginated orders for user, with items.product and delivery info.

- GET /api/orders/count
  - Returns number of non-delivered orders for the user: { count }

Notifications
- GET /api/notifications
  - Returns the user's in-app notifications: { notifications: [...] }

- GET /api/notifications/unread-count
  - Returns: { count }

- POST /api/notifications/{id}/read
  - Marks the notification as read for the authenticated user.

Delivery (for delivery role)
- POST /api/delivery/verify
  - Body: { order_id: string, phone: string, delivery_person?: string }
  - Requires the calling user.role === 'delivery'. Verifies phone matches order, marks delivery completed, logs transaction, notifies buyer. Returns { success, message, order_id }.

- GET /api/delivery/dashboard
  - Requires delivery role. Returns assigned pending deliveries with order + product data.

- POST /api/delivery/orders/{id}/complete
  - Mark order (by internal id) as delivered. Idempotent.

Admin routes (prefix: /api/admin, require auth and admin guard inside controller)
---------------------------------------------------------------------
Note: AdminController performs an explicit admin check (role === 'admin') inside methods.

GET /api/admin/dashboard
- Returns aggregated metrics (users_by_role, orders summary, payments summary, top_products, recent_orders, pending_deliveries, failed_payments).

Users
- GET /api/admin/users
  - Query params: role, is_active, exclude_admin
  - Returns paginated users with basic info and orders_count.

- POST /api/admin/users
  - Body: { name, email, password, password_confirmation, phone_number?, role (admin|user|delivery), location_id? }

- POST /api/admin/users/{id}/deactivate
- POST /api/admin/users/{id}/activate

Products (admin)
- GET /api/admin/products
  - Query param: category_id (optional). Returns paginated list.

- POST /api/admin/products
  - Body (multipart/form-data accepted): id (optional for update), name, price, category_id, stock, description?, image (file), image_url?; returns created/updated product.

- DELETE /api/admin/products/{id}

Orders & Deliveries (admin)
- GET /api/admin/orders
  - Optional ?status=...; returns paginated orders with relations.

- POST /api/admin/orders/{id}/status
  - Body: { status: one of ['pending','pending_delivery','delivered','completed'] }

- GET /api/admin/delivery-people
  - Returns users with role 'delivery'.

- POST /api/admin/deliveries/{id}/assign
  - Body: { delivery_person_id: integer }

- POST /api/admin/deliveries/{id}/unassign
- POST /api/admin/deliveries/{id}/complete

Payments (admin)
- GET /api/admin/payments
  - Optional ?status=...; returns paginated normalized payments.

- POST /api/admin/payments/{id}/approve
  - Admin approves a payment (uses cart_snapshot if present to create Order and decrement stock). Returns created order and normalized payment.

- POST /api/admin/payments/{id}/reject
  - Body: { reason?: string }

Admin notifications & locations
- POST /api/admin/notify
  - Body: { user_id?: integer, title: string, message: string }

- GET /api/admin/locations
  - Query: q, is_active, per_page

- GET /api/admin/locations/{id}
- POST /api/admin/locations
  - Body: name, slug?, type?, latitude?, longitude?, radius_km?, delivery_fee?, description?, address?, is_active?, polygon_coordinates?(array or JSON string)

- PUT /api/admin/locations/{id}
- DELETE /api/admin/locations/{id}

- GET /api/admin/summary
  - Returns counts: pending_proofs, orders_unassigned

Error handling
--------------
- Validation errors return 422 with structure: { message: 'The given data was invalid.', errors: { field: ['message'] } }
- Not authorized / forbidden return 401 / 403 with message. Admin and Delivery role checks return 403 with a descriptive message.
- Payment / business logic errors may return 400/409/422 depending on the condition (amount mismatch, stock issues, pending payment conflicts).

Examples (curl)
----------------
- Login

```bash
curl -X POST "http://127.0.0.1:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
```

- Initiate payment (auth)

```bash
curl -X POST "http://127.0.0.1:8000/api/payment/initiate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount":1000, "mobile":"099xxxx", "network":"mpamba", "location_id":1}'
```

- Place order (auth) — server expects a successful payment tx_ref

```bash
curl -X POST "http://127.0.0.1:8000/api/checkout/place-order" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tx_ref":"pay_604b...","delivery_lat":-13.9,"delivery_lng":33.8,"delivery_address":"123 Main St"}'
```

Local testing notes
-------------------
- Start Laravel backend with `php artisan serve` and point `NEXT_PUBLIC_API_BASE_URL` in the frontend `.env` to `http://127.0.0.1:8000/api`.
- For cookie-based SPA auth with Sanctum adjust `SANCTUM_STATEFUL_DOMAINS` and CORS in `cloudimart-backend/config/sanctum.php` and `config/cors.php`.

Next steps (I can do for you)
----------------------------
- Extract exact request/response JSON shapes and add example payloads for each endpoint.
- Generate an OpenAPI (Swagger) spec from the routes/controllers.
- Create a Postman collection or Insomnia export.

Changelog
- 2026-02-14: Replaced assumptions with authoritative route signatures and controller-derived shapes.

