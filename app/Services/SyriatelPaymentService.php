<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyriatelPaymentService
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

            Log::error('Syriatel Payment: Login failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
        } catch (\Exception $e) {
            Log::error('Syriatel Payment: Login exception', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Make an authenticated multipart/form-data request.
     * Syriatel API uses formdata, and signature is computed over empty string for formdata.
     */
    private function apiRequest(string $endpoint, array $formFields): ?array
    {
        $token = $this->authenticate();
        if (! $token) {
            Log::error('Syriatel Payment: Cannot make request, authentication failed', ['endpoint' => $endpoint]);

            return null;
        }

        try {
            // Signature is over empty string for multipart/formdata requests
            $signature = hash_hmac('sha256', '', $this->secret);

            $multipart = [];
            foreach ($formFields as $key => $value) {
                $multipart[] = ['name' => $key, 'contents' => (string) $value];
            }

            $response = Http::asMultipart()
                ->withHeaders([
                    'X-SIGNATURE' => $signature,
                    'Authorization' => 'Bearer '.$token,
                ])->post($this->baseUrl.$endpoint, $multipart);

            $result = $response->json();

            if ($response->successful()) {
                return $result;
            }

            Log::error('Syriatel Payment: API request failed', [
                'endpoint' => $endpoint,
                'status' => $response->status(),
                'body' => $result,
            ]);

            return $result;
        } catch (\Exception $e) {
            Log::error('Syriatel Payment: API exception', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Start a Syriatel payment (creates invoice + sends OTP in one step).
     */
    public function startPayment(string $invoice, float $amount, string $phone, string $notes = ''): ?array
    {
        return $this->apiRequest('/api/syriatel/payment/start', [
            'invoice' => $invoice,
            'amount' => $amount,
            'phone' => $phone,
            'notes' => $notes,
        ]);
    }

    /**
     * Confirm payment with OTP code.
     */
    public function confirmPayment(string $invoice, string $otp): ?array
    {
        return $this->apiRequest('/api/syriatel/payment/confirm', [
            'invoice' => $invoice,
            'otp' => $otp,
        ]);
    }

    /**
     * Resend OTP for an existing invoice.
     */
    public function resendOtp(string $invoice): ?array
    {
        return $this->apiRequest('/api/syriatel/payment/resend-otp', [
            'invoice' => $invoice,
        ]);
    }

    /**
     * Check invoice/payment status.
     */
    public function checkStatus(string $invoice): ?array
    {
        return $this->apiRequest('/api/syriatel/payment/check-status', [
            'invoice' => $invoice,
        ]);
    }
}
