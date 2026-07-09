<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FcmService
{
    private string $fcmUrl = 'https://fcm.googleapis.com/v1/projects/';

    private ?string $accessToken = null;

    /**
     * Get OAuth2 access token from Firebase service account
     */
    private function getAccessToken(): ?string
    {
        if ($this->accessToken) {
            return $this->accessToken;
        }

        try {
            $credentialsPath = storage_path('app/firebase-credentials.json');

            if (! file_exists($credentialsPath)) {
                Log::error('Firebase credentials file not found at: '.$credentialsPath);

                return null;
            }

            $credentials = json_decode(file_get_contents($credentialsPath), true);

            if (! $credentials || ! isset($credentials['private_key'], $credentials['client_email'])) {
                Log::error('Invalid Firebase credentials file');

                return null;
            }

            // Create JWT
            $now = time();
            $header = base64_encode(json_encode([
                'alg' => 'RS256',
                'typ' => 'JWT',
            ]));

            $payload = base64_encode(json_encode([
                'iss' => $credentials['client_email'],
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud' => 'https://oauth2.googleapis.com/token',
                'exp' => $now + 3600,
                'iat' => $now,
            ]));

            $signatureInput = $header.'.'.$payload;
            $privateKey = openssl_pkey_get_private($credentials['private_key']);
            openssl_sign($signatureInput, $signature, $privateKey, OPENSSL_ALGO_SHA256);
            $signature = base64_encode($signature);

            $jwt = $signatureInput.'.'.$signature;

            // Exchange JWT for access token
            $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

            if ($response->successful()) {
                $this->accessToken = $response->json()['access_token'];

                return $this->accessToken;
            }

            Log::error('Failed to get FCM access token', ['response' => $response->body()]);

            return null;

        } catch (\Exception $e) {
            Log::error('Error getting FCM access token: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Send push notification to a user's device
     *
     * @param  string  $fcmToken  The device FCM token
     * @param  string  $title  Notification title
     * @param  string  $body  Notification body
     * @param  array  $data  Additional data payload
     * @param  string  $sound  Android sound resource name (without extension)
     * @param  string|null  $deviceType  Device type stored with the FCM token
     * @return bool Success status
     */
    public function sendNotification(string $fcmToken, string $title, string $body, array $data = [], string $sound = 'default', ?string $deviceType = null): bool
    {
        try {
            $accessToken = $this->getAccessToken();

            if (! $accessToken) {
                Log::error('Cannot send FCM notification: No access token');

                return false;
            }

            $credentials = json_decode(file_get_contents(storage_path('app/firebase-credentials.json')), true);
            $projectId = $credentials['project_id'] ?? null;

            if (! $projectId) {
                Log::error('Cannot send FCM notification: No project ID');

                return false;
            }

            $url = $this->fcmUrl.$projectId.'/messages:send';
            $resolvedDeviceType = $this->resolveDeviceType($fcmToken, $deviceType);

            $payload = [
                'message' => $this->buildMessagePayload(
                    $fcmToken,
                    $title,
                    $body,
                    $data,
                    $sound,
                    $resolvedDeviceType
                ),
            ];

            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$accessToken,
                'Content-Type' => 'application/json',
            ])->post($url, $payload);

            if ($response->successful()) {
                Log::info('FCM notification sent successfully', [
                    'token' => substr($fcmToken, 0, 20).'...',
                    'title' => $title,
                    'device_type' => $resolvedDeviceType,
                ]);

                return true;
            }

            // Parse error response
            $responseBody = $response->json();
            $errorCode = $responseBody['error']['details'][0]['errorCode'] ?? null;

            // Handle UNREGISTERED tokens (invalid/expired)
            if ($errorCode === 'UNREGISTERED' || $response->status() === 404) {
                Log::warning('FCM token is invalid/expired (UNREGISTERED)', [
                    'token' => substr($fcmToken, 0, 20).'...',
                    'action' => 'Token should be removed from database',
                ]);

                // Automatically remove invalid token from database
                $this->removeInvalidToken($fcmToken);
            } else {
                Log::error('Failed to send FCM notification', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                    'error_code' => $errorCode,
                ]);
            }

            return false;

        } catch (\Exception $e) {
            Log::error('Error sending FCM notification: '.$e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);

            return false;
        }
    }

    /**
     * Build an FCM v1 message. Web/PWA tokens must be data-only because
     * firebase-messaging-sw.js manually renders the notification.
     */
    protected function buildMessagePayload(
        string $fcmToken,
        string $title,
        string $body,
        array $data,
        string $sound,
        ?string $deviceType
    ): array {
        $data = $this->normalizeDataPayload(array_merge([
            'title' => $title,
            'body' => $body,
            'icon' => '/pwa-icons/manifest-icon-192.maskable.png',
        ], $data));

        $data['url'] = $data['url'] ?? $data['web_url'] ?? $this->defaultWebUrl($data);

        $message = [
            'token' => $fcmToken,
            'data' => $data,
        ];

        if ($this->isWebDevice($deviceType)) {
            $message['webpush'] = [
                'headers' => [
                    'Urgency' => 'high',
                ],
            ];

            return $message;
        }

        $message['notification'] = [
            'title' => $title,
            'body' => $body,
        ];

        $message['android'] = [
            'priority' => 'high',
            'notification' => [
                'channel_id' => 'high_importance_channel',
                'sound' => $sound,
                'default_sound' => $sound === 'default',
                'notification_priority' => 'PRIORITY_HIGH',
                'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
            ],
        ];

        $message['apns'] = [
            'headers' => [
                'apns-priority' => '10',
            ],
            'payload' => [
                'aps' => [
                    'sound' => 'default',
                    'badge' => 1,
                    'content-available' => 1,
                ],
            ],
        ];

        return $message;
    }

    protected function resolveDeviceType(string $fcmToken, ?string $deviceType): ?string
    {
        if ($deviceType !== null && trim($deviceType) !== '') {
            return strtolower(trim($deviceType));
        }

        $storedDeviceType = \DB::table('users')
            ->where('fcm_token', $fcmToken)
            ->value('device_type');

        return $storedDeviceType ? strtolower(trim($storedDeviceType)) : null;
    }

    protected function isWebDevice(?string $deviceType): bool
    {
        return in_array($deviceType, ['web', 'pwa', 'browser'], true);
    }

    protected function normalizeDataPayload(array $data): array
    {
        $normalized = [];

        foreach ($data as $key => $value) {
            if ($value === null) {
                continue;
            }

            if (is_bool($value)) {
                $normalized[(string) $key] = $value ? 'true' : 'false';

                continue;
            }

            if (is_scalar($value)) {
                $normalized[(string) $key] = (string) $value;

                continue;
            }

            $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

            if ($encoded !== false) {
                $normalized[(string) $key] = $encoded;
            }
        }

        return $normalized;
    }

    protected function defaultWebUrl(array $data): string
    {
        if (! empty($data['shipment_id'])) {
            return '/customer/shipments/'.$data['shipment_id'];
        }

        return '/customer/notifications';
    }

    /**
     * Send notification to multiple devices
     *
     * @param  array  $fcmTokens  Array of device FCM tokens
     * @param  string  $title  Notification title
     * @param  string  $body  Notification body
     * @param  array  $data  Additional data payload
     * @return array Results array with success/failure counts
     */
    public function sendMulticast(array $fcmTokens, string $title, string $body, array $data = [], string $sound = 'default'): array
    {
        $results = [
            'success' => 0,
            'failure' => 0,
            'failed_tokens' => [],
        ];

        foreach ($fcmTokens as $token) {
            if ($this->sendNotification($token, $title, $body, $data, $sound)) {
                $results['success']++;
            } else {
                $results['failure']++;
                $results['failed_tokens'][] = $token;
            }
        }

        return $results;
    }

    /**
     * Remove invalid/expired FCM token from database
     *
     * @param  string  $fcmToken  The invalid token to remove
     */
    protected function removeInvalidToken(string $fcmToken): void
    {
        try {
            // Find user with this token and clear it
            $affectedRows = \DB::table('users')
                ->where('fcm_token', $fcmToken)
                ->update([
                    'fcm_token' => null,
                    'device_type' => null,
                    'updated_at' => now(),
                ]);

            if ($affectedRows > 0) {
                Log::info('Automatically removed invalid FCM token from database', [
                    'token' => substr($fcmToken, 0, 20).'...',
                    'affected_users' => $affectedRows,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to remove invalid FCM token from database: '.$e->getMessage());
        }
    }
}
