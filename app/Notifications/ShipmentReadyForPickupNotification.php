<?php

namespace App\Notifications;

use App\Notifications\Concerns\LocalizedFcm;
use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ShipmentReadyForPickupNotification extends Notification implements ShouldQueue
{
    use LocalizedFcm;
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly ?string $pickupLocation = null,
        public readonly ?string $pickupAddress = null
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    /**
     * Send FCM push notification
     */
    public function toFcm(object $notifiable): void
    {
        // Only send FCM if user has push notifications enabled and has a token
        if (! $notifiable->push_notifications || ! $notifiable->fcm_token) {
            return;
        }

        $fcmService = app(FcmService::class);

        $title = $this->fcmTranslate($notifiable, 'fcmTitleShipmentReadyForPickup');
        $body = $this->fcmTranslate($notifiable, 'fcmBodyShipmentReadyForPickup', [
            'trackingNumber' => $this->trackingNumber,
        ]);

        if ($this->pickupLocation) {
            $body .= ' '.$this->fcmTranslate($notifiable, 'fcmBodyShipmentReadyForPickupLocation', [
                'pickupLocation' => $this->pickupLocation,
            ]);
        }

        $data = [
            'type' => 'shipment_ready_for_pickup',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'pickup_location' => $this->pickupLocation,
            'pickup_address' => $this->pickupAddress,
            'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
        ];

        $fcmService->sendNotification(
            $notifiable->fcm_token,
            $title,
            $body,
            $data
        );
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $title = 'dbTitleShipmentReadyForPickup';
        if ($this->pickupLocation) {
            $content = $this->pickupAddress
                ? 'notificationContentReadyForPickupBaseWithLocationAddress'
                : 'notificationContentReadyForPickupBaseWithLocation';
        } else {
            $content = $this->pickupAddress
                ? 'notificationContentReadyForPickupBaseNoLocationAddress'
                : 'notificationContentReadyForPickupBaseNoLocation';
        }

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => 'ready_for_pickup',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'pickup_location' => $this->pickupLocation,
            'pickup_address' => $this->pickupAddress,
        ];
    }

    /**
     * Get the database representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toDatabase(object $notifiable): array
    {
        return $this->toArray($notifiable);
    }
}
