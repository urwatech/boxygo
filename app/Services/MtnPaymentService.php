<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MtnPaymentService
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
              ->post($this->baseUrl . '/api/auth/login');

            if ($response->successful()) {
                $this->accessToken = $response->json('data.tokens.access_token');
                return $this->accessToken;
            }

            Log::error('MTN Payment: Login failed', [
                'status' => $response->status(),
                'body' => $response->json(),
            ]);
        } catch (\Exception $e) {
            Log::error('MTN Payment: Login exception', ['error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Make an authenticated JSON request to the MTN API.
     */
    private function apiRequest(string $method, string $endpoint, array $data = []): ?array
    {
        $token = $this->authenticate();
        if (!$token) {
            Log::error('MTN Payment: Cannot make request, authentication failed', ['endpoint' => $endpoint]);
            return null;
        }

        try {
            $jsonBody = json_encode($data);
            $signature = hash_hmac('sha256', $jsonBody, $this->secret);

            $response = Http::withHeaders([
                'X-SIGNATURE' => $signature,
                'Authorization' => 'Bearer ' . $token,
                'Content-Type' => 'application/json',
            ])->withBody($jsonBody, 'application/json')
              ->{$method}($this->baseUrl . $endpoint);

            $result = $response->json();

            if ($response->successful() && ($result['success'] ?? false)) {
                return $result;
            }

            Log::error('MTN Payment: API request failed', [
                'endpoint' => $endpoint,
                'status' => $response->status(),
                'body' => $result,
            ]);

            return $result; // Return even on failure so caller can read error details
        } catch (\Exception $e) {
            Log::error('MTN Payment: API exception', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Create an invoice on the MTN payment gateway.
     */
    public function createInvoice(int $invoice, float $amount, string $phone, int $ttl = 60): ?array
    {
        return $this->apiRequest('post', '/api/mtn/v1/invoice/create', [
            'amount' => $amount,
            'invoice' => $invoice,
            'ttl' => $ttl,
            'phone' => $phone,
        ]);
    }

    /**
     * Initiate a payment (sends OTP to customer phone).
     */
    public function initiatePayment(int $invoice, string $phone, string $guid): ?array
    {
        return $this->apiRequest('post', '/api/mtn/v1/payment/initiate', [
            'invoice' => $invoice,
            'phone_clinte' => $phone,
            'guid' => $guid,
        ]);
    }

    /**
     * Confirm a payment with the OTP code.
     */
    public function confirmPayment(string $phone, string $guid, int $operationNumber, int $invoice, string $code): ?array
    {
        return $this->apiRequest('post', '/api/mtn/v1/payment/confirm', [
            'phone' => $phone,
            'guid' => $guid,
            'operation_number' => $operationNumber,
            'invoice' => $invoice,
            'code' => $code,
        ]);
    }

    /**
     * Get invoice status.
     */
    public function getInvoice(int $invoice): ?array
    {
        return $this->apiRequest('post', '/api/mtn/v1/invoice/get', [
            'invoice' => $invoice,
        ]);
    }
}
