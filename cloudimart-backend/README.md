# Cloudimart Backend (Laravel)

This folder contains the Laravel backend for the Cloudimart prototype. It exposes APIs for products, categories, cart and checkout, enforces location-based checkout restrictions, generates and stores Order IDs, and contains delivery confirmation endpoints.

## Quick overview

- Framework: Laravel (PHP)
- Key responsibilities:
  - Product and category APIs
  - Cart/purchase endpoints
  - Location validation for checkout
  - Order ID generation and storage
  - Delivery confirmation and transaction logging

## Prerequisites

- PHP 8.x (as required by composer.json)
- Composer
- MySQL or compatible database
- Node (optional, only for frontend build tasks if run here)

## Setup (Windows PowerShell)

1. Install PHP and Composer if you haven't already.
2. From this backend folder run:

```powershell
cd c:\Users\aRelic\Downloads\relic\cloudimart-project\cloudimart-backend
composer install
cp .env.example .env
# edit .env to set DB credentials, MAIL and SMS provider configs
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve --port=8000
```

The server will run by default at http://127.0.0.1:8000.

## Important files and locations

- `app/Models/` — Eloquent models (Product, Category, Order, OrderItem, Cart, CartItem, User)
- `app/Services/LocationService.php` — location validation logic used during checkout
- `app/Traits/GeneratesOrderId.php` — trait used to create unique Order IDs on order creation
- `routes/api.php` — API routes (product listing, cart, checkout, orders)
- `database/migrations/` — migration files to create database schema

## Configured Local Delivery Locations

The prototype restricts checkout to the Mzuzu University community. The default list of allowed locations (updateable in `LocationService.php` or via config) includes:

- Mzuzu University
- Mzuzu Central Hospital
- Luwinga
- Area 1B
- KAKA
- Nearby surrounding locations

When a checkout request is received the backend validates the supplied delivery location against this list; if not present the order is rejected with a 403 and an explanatory message.

## Order ID generation and notification

- When an order is successfully placed and payment is confirmed (prototype: simulated), the system:
  1. Generates a unique Order ID using `GeneratesOrderId` and stores it on the `orders` table.
  2. Persists the order and its items.
  3. Dispatches notification hooks for email and SMS. The prototype includes hooks; to enable them configure the `MAIL_*` and the SMS provider environment variables in `.env` and implement provider credentials.

### Delivery confirmation flow (prototype)

1. Delivery person receives the order and (on delivery) the customer shows the Order ID.
2. Delivery person opens the delivery confirmation endpoint/form and submits:
   - Order ID
   - Phone number of the order collector
3. Backend validates the Order ID and phone; marks order as delivered (status update) and logs the transaction as complete.
4. Backend sends a delivery confirmation to the customer (email/SMS) and stores the delivery timestamp.

## Running tests

This prototype contains PHPUnit configuration (`phpunit.xml`). To run unit tests:

```powershell
php vendor\bin\phpunit
```

Note: tests are limited for prototype. Add integration tests for the checkout location validation and delivery confirmation flows as next steps.

## Environment & production notes

- Use queue workers to send emails/SMS in production (Laravel queue: redis or database driver).
- Use a reliable SMS provider (e.g., Twilio) and a transactional email provider (Mailgun, SendGrid) for production notifications.
- Protect endpoints with authentication (Sanctum is included in config) where necessary; delivery confirmation should require a delivery-person role in a real system.

## Developer tips

- If you change the allowed locations, update `app/Services/LocationService.php` and add migrations or seeders if you model locations in the DB.
- OrderID generation is centralized in `app/Traits/GeneratesOrderId.php` — reuse this to keep IDs unique and consistent.
<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework. You can also check out [Laravel Learn](https://laravel.com/learn), where you will be guided through building a modern Laravel application.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com)**
- **[Tighten Co.](https://tighten.co)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
