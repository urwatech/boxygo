<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymeraPaymentService
{
    private string $baseUrl;

    private string $secret;

    private ?string $accessToken = null;

    public function __construct()
    {
        $this->baseUrl = (string) config('services.mtn_payment.base_url');
        $this->secret = (string) config('services.mtn_payment.secret');
    }

    protected function authenticate(): ?string
    {
        if ($this->accessToken) {
            return $this->accessToken;
        }

        try {
            $loginBody = json_encode([
                'email' => config('services.mtn_payment.email'),
                'password' => config('services.mtn_payment.password'),
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

            Log::error('Paymera: Login failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
        } catch (\Exception $e) {
            Log::error('Paymera: Login exception', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Make an authenticated JSON request.
     */
    private function apiRequest(string $method, string $endpoint, array $data = []): ?array
    {
        $token = $this->authenticate();
        if (! $token) {
            return null;
        }

        try {
            $jsonBody = json_encode($data);
            $signature = hash_hmac('sha256', $jsonBody, $this->secret);

            $response = Http::withHeaders([
                'X-SIGNATURE' => $signature,
                'Authorization' => 'Bearer '.$token,
                'Content-Type' => 'application/json',
            ])->withBody($jsonBody, 'application/json')
                ->{$method}($this->baseUrl.$endpoint);

            return $response->json();
        } catch (\Exception $e) {
            Log::error('Paymera: API exception', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Create a Paymera payment. Returns a redirect URL for the customer.
     */
    public function createPayment(string $invoice, float $amount, string $callbackUrl, string $lang = 'en', ?string $appUser = null, string $notes = '', int $ttl = 60): ?array
    {
        $data = [
            'invoice' => $invoice,
            'amount' => $amount,
            'collback' => $callbackUrl,
            'lang' => $lang,
            'appUser' => $appUser,
            'notes' => $notes,
            'ttl' => $ttl,
        ];

        return $this->apiRequest('post', '/api/paymera/create', $data);
    }

    /**
     * Extract the payment URL from a createPayment response.
     */
    public static function extractPaymentUrl(?array $result): ?string
    {
        return $result['data']['paymera_response']['Data']['url']
            ?? $result['data']['paymera_response']['Data']['redirect_url']
            ?? null;
    }

    /**
     * Extract the payment ID from a createPayment response.
     */
    public static function extractPaymentId(?array $result): ?string
    {
        return $result['data']['paymera_response']['Data']['paymentId'] ?? null;
    }

    /**
     * Get invoice/payment status.
     */
    public function getInvoiceStatus(string $invoice): ?array
    {
        $token = $this->authenticate();
        if (! $token) {
            return null;
        }

        try {
            // GET request — signature over empty body
            $signature = hash_hmac('sha256', '', $this->secret);

            $response = Http::withHeaders([
                'X-SIGNATURE' => $signature,
                'Authorization' => 'Bearer '.$token,
            ])->get($this->baseUrl.'/api/paymera/invoice/'.$invoice);

            return $response->json();
        } catch (\Exception $e) {
            Log::error('Paymera: Get invoice exception', ['error' => $e->getMessage()]);
        }

        return null;
    }
}
