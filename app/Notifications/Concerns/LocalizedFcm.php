<?php

namespace App\Notifications\Concerns;

trait LocalizedFcm
{
    protected function fcmLocale(object $notifiable): string
    {
        $language = strtolower((string) ($notifiable->language ?? 'en'));

        return $language === 'ar' ? 'ar' : 'en';
    }

    protected function fcmTranslate(object $notifiable, string $key, array $replace = []): string
    {
        $translated = __($key, $replace, $this->fcmLocale($notifiable));

        // Also replace {{placeholder}} syntax used in JSON translation files
        foreach ($replace as $placeholder => $value) {
            $translated = str_replace('{{' . $placeholder . '}}', (string) $value, $translated);
        }

        return $translated;
    }
}
