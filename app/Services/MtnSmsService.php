<?php

namespace App\Services;

use App\Jobs\SendMtnSmsJob;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MtnSmsService
{
    private string $baseUrl;

    private string $secret;

    private ?string $accessToken = null;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.mtn_sms.base_url');
        $this->secret = (string) config('services.mtn_sms.secret');
    }

    /**
     * Authenticate and get access token from the SMS gateway.
     */
    protected function authenticate(): ?string
    {
        if ($this->accessToken) {
            return $this->accessToken;
        }

        try {
            $loginBody = json_encode([
                'email' => config('services.mtn_sms.email'),
                'password' => config('services.mtn_sms.password'),
            ]);

            $signature = hash_hmac('sha256', $loginBody, $this->secret);

            $response = Http::withHeaders([
                'X-SIGNATURE' => $signature,
                'Content-Type' => 'application/json',
            ])->withBody($loginBody, 'application/json')
                ->post($this->baseUrl.'/api/auth/login');

            if ($response->successful()) {
                $this->accessToken = $response->json('data.tokens.access_token');

                return $this->accessToken;
            }

            Log::error('MTN SMS: Login failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
        } catch (\Exception $e) {
            Log::error('MTN SMS: Login exception', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Send an SMS message.
     */
    public function send(string $phone, string $message, string $type = 'general'): bool
    {
        if (trim($phone) === '' || trim($message) === '') {
            Log::warning('MTN SMS: Skipped queueing empty SMS payload', [
                'phone' => $phone,
                'type' => $type,
            ]);

            return false;
        }

        SendMtnSmsJob::dispatch($phone, $message, $type);

        Log::info('MTN SMS: Queued for sending', [
            'phone' => $phone,
            'type' => $type,
        ]);

        return true;
    }

    /**
     * Send an SMS message immediately. Queue jobs call this method.
     */
    public function sendNow(string $phone, string $message, string $type = 'general'): bool
    {
        $token = $this->authenticate();
        if (! $token) {
            Log::error('MTN SMS: Cannot send, authentication failed', ['phone' => $phone]);

            return false;
        }

        try {
            $signature = hash_hmac('sha256', '', $this->secret);

            $response = Http::asMultipart()
                ->withHeaders([
                    'X-SIGNATURE' => $signature,
                    'Authorization' => 'Bearer '.$token,
                ])->post($this->baseUrl.'/api/sms/send', [
                    ['name' => 'phone', 'contents' => $phone],
                    ['name' => 'message', 'contents' => $message],
                    ['name' => 'type', 'contents' => $type],
                ]);

            if ($response->successful()) {
                Log::info('MTN SMS: Sent successfully', [
                    'phone' => $phone,
                    'type' => $type,
                ]);

                return true;
            }

            Log::error('MTN SMS: Send failed', [
                'phone' => $phone,
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
        } catch (\Exception $e) {
            Log::error('MTN SMS: Send exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
            ]);
        }

        return false;
    }

    /**
     * Send a localized SMS to a user based on their language preference.
     */
    public function sendLocalized(string $phone, string $translationKey, array $replace = [], string $locale = 'en', string $type = 'general'): bool
    {
        $message = __($translationKey, $replace, $locale);

        // Also replace {{placeholder}} syntax used in JSON translation files
        foreach ($replace as $placeholder => $value) {
            $message = str_replace('{{'.$placeholder.'}}', (string) $value, $message);
        }

        return $this->send($phone, $message, $type);
    }

    /**
     * Send a localized SMS immediately. Queue jobs can use this when needed.
     */
    public function sendLocalizedNow(string $phone, string $translationKey, array $replace = [], string $locale = 'en', string $type = 'general'): bool
    {
        $message = __($translationKey, $replace, $locale);

        foreach ($replace as $placeholder => $value) {
            $message = str_replace('{{'.$placeholder.'}}', (string) $value, $message);
        }

        return $this->sendNow($phone, $message, $type);
    }

    /**
     * Send SMS to a notifiable (user) with automatic locale detection.
     */
    public function sendToUser(object $notifiable, string $phone, string $translationKey, array $replace = [], string $type = 'general'): bool
    {
        $locale = strtolower((string) ($notifiable->language ?? 'en'));
        $locale = $locale === 'ar' ? 'ar' : 'en';

        return $this->sendLocalized($phone, $translationKey, $replace, $locale, $type);
    }
}
