# BoxyGo

BoxyGo is an open-source courier and parcel delivery management platform. It covers the full lifecycle of a shipment — booking, pickup, warehousing, zone-based rider assignment, drop points, delivery with proof and OTP verification, returns, and cash-on-delivery settlement — through an admin panel, a customer portal, and a REST API for rider mobile apps.

Built with **Laravel 12**, **Inertia.js 2**, **React 18**, and **Tailwind CSS 4**.

## Features

- **Shipment management** — direct and indirect (drop-point) deliveries, scheduling, parcel sizing, insurance, special instructions, barcode/QR tracking, and status history.
- **Admin panel** (`/admin`) — dashboards, user onboarding, shipment assignment, zone drawing on a map, drop points, warehouses and shelf management, billing, and COD reconciliation.
- **Customer portal** — booking, saved addresses, shipment tracking, returns, wallet, and notifications.
- **Rider API** (`routes/api.php`, Sanctum) — registration with OTP verification, job lists, status updates, proof of delivery, navigation, and COD collection for driver mobile apps.
- **Zones & pricing** — polygon delivery zones, governorate/city-based pricing via a configurable `PriceCalculator` (see [docs/PriceCalculator-Usage.md](docs/PriceCalculator-Usage.md)).
- **Roles & permissions** — [Spatie Laravel Permission](https://spatie.be/docs/laravel-permission) with `resource.action` naming; protected `superadmin` and `customer` roles.
- **Notifications** — Firebase Cloud Messaging web push, database notifications, and SendGrid transactional email templates.
- **Payments & wallets** — pluggable payment gateway services (MTN, Syriatel, Paymera), wallets, and payment transactions.
- **Internationalization** — English and Arabic (RTL) out of the box.
- **PWA** — installable web app with service worker and offline assets.

## Architecture

The backend follows a service layer and repository pattern: repositories encapsulate data access, services contain business logic, and both are bound to interfaces in `RepositoryServiceProvider`. API controllers return consistent JSON through the centralized `ApiResponse` class ([app/Http/ApiResponse.php](app/Http/ApiResponse.php)). See the [docs/](docs/) folder for API and module documentation.

```
app/
├── Http/Controllers/{Api,Auth,Customer,SuperAdmin}
├── Services/          # business logic (pricing, payments, SMS, FCM, ...)
├── Repositories/      # data access
├── Contracts/         # service/repository interfaces
├── Jobs/  Mail/  Notifications/  Enums/  Traits/
routes/
├── web.php            # customer portal
├── admin.php          # admin panel (superadmin role)
└── api.php            # v1 REST API for mobile apps (Sanctum)
```

## Requirements

- PHP ^8.2
- Composer
- Node.js 20+
- MySQL 8

## Installation

```bash
git clone <repository-url> boxygo
cd boxygo

composer install
cp .env.example .env
php artisan key:generate
```

Configure your database in `.env`, then either run the migrations with seeders:

```bash
php artisan migrate --seed
```

…or import the full demo dataset (cities, zones, shipments, users):

```bash
mysql -u <user> -p boxygo < database/database.sql
```

Build the frontend and start the app:

```bash
npm install
npm run build   # or `npm run dev` during development
php artisan serve
```

### Demo accounts

| Portal | Email | Password |
|---|---|---|
| Admin panel | `admin@example.com` | `123456` (seeder) / `password` (SQL dump) |
| Customer | `customer@example.com` | `123456` (seeder) / `password` (SQL dump) |
| Driver (API) | `driver@example.com` | `123456` (seeder) / `password` (SQL dump) |
| Drop-point keeper | `keeper@example.com` | `123456` (seeder) / `password` (SQL dump) |

All demo data is fictional; every account in the SQL dump uses the password `password`.

## Configuration

All third-party integrations are optional and configured through `.env` (see [.env.example](.env.example) for the full list):

| Integration | Keys | Notes |
|---|---|---|
| Google Maps / Places | `GOOGLE_MAPS_API_KEY`, `GOOGLE_PLACES_API_KEY` | Set `MAP_PROVIDER=google`; defaults to OpenStreetMap, which needs no key |
| Firebase push | `VITE_FIREBASE_*` | Also place the service-account JSON at `storage/app/firebase-credentials.json` (gitignored) |
| SendGrid email | `SENDGRID_API_KEY`, `SENDGRID_*_TEMPLATE_ID` | Use `MAIL_MAILER=log` locally |
| SMS gateway | `MTN_SMS_*` | OTP delivery |
| Payment gateway | `MTN_PAYMENT_*` | Shared by the MTN, Syriatel, and Paymera services |
| Pricing | `PRICING_PLATFORM_FEE`, `PRICING_VAT_RATE` | Plus route pricing in [config/pricing.php](config/pricing.php) |

## Testing

```bash
php artisan test
```

Code style is enforced with [Laravel Pint](https://laravel.com/docs/pint):

```bash
vendor/bin/pint
```

## Documentation

- [API overview](docs/API_README.md)
- [Jobs API](docs/API_JOBS_DOCUMENTATION.md)
- [User notifications API](docs/API_USER_NOTIFICATIONS.md)
- [Price calculator](docs/PriceCalculator-Usage.md)
- [Zones](docs/ZONE_BLUEPRINT.md)
- [Model factories](docs/FACTORY_USAGE.md)

## License

BoxyGo is open-source software licensed under the [MIT license](LICENSE).
