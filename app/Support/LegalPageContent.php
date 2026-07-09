<?php

namespace App\Support;

use App\Models\LegalPage;
use Illuminate\Support\Facades\Schema;

class LegalPageContent
{
    public const TERMS_SLUG = 'terms_and_conditions';

    private const SUPPORTED_LOCALES = ['en', 'ar'];

    public static function terms(?string $locale = null): array
    {
        return self::page(self::TERMS_SLUG, $locale);
    }

    public static function termsForSettings(): array
    {
        $pages = [];

        foreach (self::SUPPORTED_LOCALES as $locale) {
            $pages[$locale] = self::page(self::TERMS_SLUG, $locale, false);
        }

        return $pages;
    }

    public static function persistTerms(array $localizedTerms): void
    {
        foreach (self::SUPPORTED_LOCALES as $locale) {
            $payload = $localizedTerms[$locale] ?? [];

            LegalPage::query()->updateOrCreate(
                [
                    'slug' => self::TERMS_SLUG,
                    'locale' => $locale,
                ],
                [
                    'title' => self::nullableTrim($payload['title'] ?? null),
                    'body' => self::sanitizeBody($payload['body'] ?? null),
                    'is_active' => true,
                ]
            );
        }
    }

    private static function page(string $slug, ?string $locale = null, bool $fallbackToDefaultLocale = true): array
    {
        $locale = self::normalizeLocale($locale);
        $page = self::findPage($slug, $locale);

        if (! $page && $fallbackToDefaultLocale && $locale !== 'en') {
            $page = self::findPage($slug, 'en');
        }

        $fallbackLocale = $page?->locale ?? $locale;
        $fallback = self::fallback($slug, $fallbackLocale);

        return [
            'slug' => $slug,
            'locale' => $fallbackLocale,
            'title' => filled($page?->title) ? $page->title : $fallback['title'],
            'body' => filled($page?->body) ? $page->body : $fallback['body'],
            'updated_at' => $page?->updated_at?->toISOString(),
        ];
    }

    private static function findPage(string $slug, string $locale): ?LegalPage
    {
        if (! Schema::hasTable('legal_pages')) {
            return null;
        }

        return LegalPage::query()
            ->where('slug', $slug)
            ->where('locale', $locale)
            ->where('is_active', true)
            ->first();
    }

    private static function fallback(string $slug, string $locale): array
    {
        if ($slug !== self::TERMS_SLUG) {
            return [
                'title' => '',
                'body' => '',
            ];
        }

        return [
            'title' => self::translate('commonTermsConditions', $locale),
            'body' => self::defaultTermsBody($locale),
        ];
    }

    private static function defaultTermsBody(string $locale): string
    {
        $pricingItems = implode(', ', [
            self::translate('settingsTermsPricingParcelSize', $locale),
            self::translate('settingsTermsPricingVehicleType', $locale),
            self::translate('settingsTermsPricingDistance', $locale),
        ]);

        return implode("\n\n", [
            self::translate('settingsTermsWelcome', $locale),
            self::translate('servicesProvidedTitle', $locale)."\n".self::translate('settingsTermsServicesProvidedContent', $locale),
            self::translate('commonAccountResponsibility', $locale)."\n".self::translate('settingsTermsAccountResponsibilityContent', $locale),
            self::translate('settingsTermsPricingPayments', $locale)."\n".self::translate('settingsTermsPricingIntro', $locale).' '.$pricingItems."\n".self::translate('settingsTermsPricingPayment', $locale),
            self::translate('commonCancellationsRefunds', $locale)."\n".implode("\n", [
                self::translate('settingsTermsCancellationBefore', $locale),
                self::translate('settingsTermsCancellationRefunds', $locale),
                self::translate('settingsTermsCancellationAfter', $locale),
            ]),
            self::translate('commonContactUs', $locale)."\n".self::translate('settingsTermsContactContent', $locale).' '.self::translate('settingsTermsContactEmail', $locale),
        ]);
    }

    private static function translate(string $key, string $locale): string
    {
        $value = __($key, [], $locale);

        return $value === $key ? '' : $value;
    }

    private static function normalizeLocale(?string $locale): string
    {
        $normalized = strtolower(str_replace('_', '-', (string) ($locale ?: app()->getLocale())));
        $language = explode('-', $normalized)[0] ?: 'en';

        return in_array($language, self::SUPPORTED_LOCALES, true) ? $language : 'en';
    }

    private static function nullableTrim($value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private static function sanitizeBody($value): ?string
    {
        $body = self::nullableTrim($value);

        if ($body === null) {
            return null;
        }

        $allowedTags = '<p><br><div><h1><h2><h3><h4><ul><ol><li><strong><b><em><i><u><a><blockquote>';
        $body = preg_replace('/<(script|style)\b[^>]*>.*?<\/\1>/is', '', $body);
        $body = strip_tags($body, $allowedTags);
        $body = preg_replace('/\s+on[a-z]+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $body);
        $body = preg_replace('/\s+(style|class|id)\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+)/i', '', $body);

        return preg_replace_callback('/<a\b([^>]*)>/i', function (array $matches): string {
            $attributes = $matches[1] ?? '';
            $href = null;

            if (preg_match('/\shref\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $attributes, $hrefMatch)) {
                $href = $hrefMatch[2] ?? $hrefMatch[3] ?? $hrefMatch[4] ?? null;
            }

            if (! $href || ! preg_match('/^(https?:|mailto:|tel:|#|\/)/i', $href)) {
                return '<a>';
            }

            $safeHref = e($href);

            return '<a href="'.$safeHref.'" target="_blank" rel="noopener noreferrer">';
        }, $body);
    }
}
