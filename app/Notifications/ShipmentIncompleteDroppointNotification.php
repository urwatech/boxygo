<?php

namespace App\Notifications;

use App\Notifications\Concerns\LocalizedFcm;
use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ShipmentIncompleteDroppointNotification extends Notification implements ShouldQueue
{
    use LocalizedFcm;
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
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

        $title = $this->fcmTranslate($notifiable, 'dbTitleShipmentIncompleteDroppoint');
        $body = $this->fcmTranslate($notifiable, 'dbBodyShipmentIncompleteDroppoint', [
            'trackingNumber' => $this->trackingNumber,
        ]);

        $data = [
            'type' => 'incomplete_into_droppoint',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
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
        $title = 'dbTitleShipmentIncompleteDroppoint';
        $content = 'dbBodyShipmentIncompleteDroppoint';

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => 'incomplete_into_droppoint',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
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
