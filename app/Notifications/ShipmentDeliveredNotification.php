<?php

namespace App\Notifications;

use App\Notifications\Concerns\LocalizedFcm;
use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ShipmentDeliveredNotification extends Notification implements ShouldQueue
{
    use LocalizedFcm;
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly ?string $riderName = null,
        public readonly ?string $deliveredAt = null,
        public readonly ?string $role = 'sender'
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

        $title = $this->fcmTranslate($notifiable, 'fcmTitleShipmentDelivered');
        $body = $this->riderName
            ? $this->fcmTranslate($notifiable, 'fcmBodyShipmentDeliveredBy', [
                'trackingNumber' => $this->trackingNumber,
                'riderName' => $this->riderName,
            ])
            : $this->fcmTranslate($notifiable, 'fcmBodyShipmentDelivered', [
                'trackingNumber' => $this->trackingNumber,
            ]);

        $data = [
            'type' => 'shipment_delivered',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'rider_name' => $this->riderName,
            'delivered_at' => $this->deliveredAt,
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
        $title = 'dbTitleShipmentDelivered';
        $content = $this->riderName
            ? 'notificationContentShipmentDeliveredByWithThanks'
            : 'notificationContentShipmentDeliveredWithThanks';

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => 'shipment_delivered',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'rider_name' => $this->riderName,
            'delivered_at' => $this->deliveredAt,
            'role' => $this->role,
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
