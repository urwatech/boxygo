<?php

namespace Tests\Unit;

use App\Services\FcmService;
use PHPUnit\Framework\TestCase;

class FcmServicePayloadTest extends TestCase
{
    public function test_web_push_payload_is_data_only(): void
    {
        $service = $this->makeService();

        $payload = $service->messagePayload(
            'web-token',
            'Shipment updated',
            'Your shipment changed status.',
            [
                'shipment_id' => 123,
                'nullable' => null,
                'urgent' => true,
            ],
            'default',
            'web'
        );

        $this->assertArrayNotHasKey('notification', $payload);
        $this->assertArrayNotHasKey('android', $payload);
        $this->assertArrayNotHasKey('apns', $payload);
        $this->assertSame('web-token', $payload['token']);
        $this->assertSame('Shipment updated', $payload['data']['title']);
        $this->assertSame('Your shipment changed status.', $payload['data']['body']);
        $this->assertSame('123', $payload['data']['shipment_id']);
        $this->assertSame('true', $payload['data']['urgent']);
        $this->assertSame('/customer/shipments/123', $payload['data']['url']);
        $this->assertArrayNotHasKey('nullable', $payload['data']);
        $this->assertSame('high', $payload['webpush']['headers']['Urgency']);
    }

    public function test_native_payload_keeps_notification_block(): void
    {
        $service = $this->makeService();

        $payload = $service->messagePayload(
            'native-token',
            'Delivery assigned',
            'You have a new delivery.',
            [
                'type' => 'delivery_assigned',
                'count' => 2,
            ],
            'default',
            'android'
        );

        $this->assertSame('native-token', $payload['token']);
        $this->assertSame('Delivery assigned', $payload['notification']['title']);
        $this->assertSame('You have a new delivery.', $payload['notification']['body']);
        $this->assertSame('delivery_assigned', $payload['data']['type']);
        $this->assertSame('2', $payload['data']['count']);
        $this->assertSame('high_importance_channel', $payload['android']['notification']['channel_id']);
        $this->assertSame('default', $payload['apns']['payload']['aps']['sound']);
    }

    private function makeService(): object
    {
        return new class extends FcmService
        {
            public function messagePayload(
                string $fcmToken,
                string $title,
                string $body,
                array $data,
                string $sound,
                ?string $deviceType
            ): array {
                return $this->buildMessagePayload($fcmToken, $title, $body, $data, $sound, $deviceType);
            }
        };
    }
}
