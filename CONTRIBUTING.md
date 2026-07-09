# Contributing to BoxyGo

Thank you for considering contributing to BoxyGo! This document explains how to get set up and what we expect from contributions.

## Getting started

1. Fork the repository and clone your fork.
2. Follow the [installation steps in the README](README.md#installation) to get a working local environment.
3. Create a feature branch off `main`:

```bash
git checkout -b feature/short-description
```

## Development workflow

- **Backend** code lives in `app/` and follows a service layer + repository pattern — controllers stay thin, business logic goes in `app/Services/`, data access in `app/Repositories/`, bound via interfaces in `app/Contracts/`.
- **Frontend** pages live in `resources/js/Pages/` (Inertia + React), shared components in `resources/js/Components/`.
- API endpoints return responses through `App\Http\ApiResponse` — don't build JSON responses by hand.
- User-facing strings must go through the translation files (`lang/en.json`, `lang/ar.json`) — never hardcode display text.
- New database changes need a migration; guard any raw MySQL-specific SQL with a `DB::getDriverName()` check so the SQLite test suite keeps working.

## Before you open a pull request

1. **Code style** — run Pint; CI rejects unformatted code:

```bash
vendor/bin/pint
```

2. **Tests** — the suite runs on in-memory SQLite and must pass:

```bash
php artisan test
```

Add tests for new behavior — feature tests under `tests/Feature/`, unit tests under `tests/Unit/`.

3. **Frontend** — make sure assets still build:

```bash
npm run build
```

## Pull request guidelines

- Keep PRs focused — one feature or fix per PR.
- Describe *what* changed and *why*; link related issues.
- Never commit secrets, `.env` files, or real user data. Demo/seed data must use `example.com` emails and fake phone numbers.
- CI (tests on PHP 8.2/8.4, Pint, frontend build) must be green.

## Reporting bugs

Open a GitHub issue with steps to reproduce, expected vs. actual behavior, and your environment (PHP version, database, browser if frontend).

## Reporting security vulnerabilities

Please do **not** open a public issue for security problems. Report them privately to the maintainers so a fix can be released before disclosure.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
