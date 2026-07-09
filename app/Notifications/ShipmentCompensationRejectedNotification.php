<?php

namespace App\Notifications;

use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use App\Notifications\Concerns\LocalizedFcm;

class ShipmentCompensationRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use LocalizedFcm;
    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly int $amount,
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
     *
     * @param object $notifiable
     * @return void
     */
    public function toFcm(object $notifiable): void
    {
        // Only send FCM if user has push notifications enabled and has a token
        if (!$notifiable->push_notifications || !$notifiable->fcm_token) {
            return;
        }

        $fcmService = app(FcmService::class);

        $title = $this->fcmTranslate($notifiable, 'dbTitleShipmentCompensationRejected');
        $body = $this->fcmTranslate($notifiable, 'dbBodyShipmentCompensationRejected', [
            'trackingNumber' => $this->trackingNumber,
        ]);

        $data = [
            'type' => 'shipment_compensation_rejected',
            'shipment_id' => $this->shipmentId,
            'order_number' => $this->trackingNumber,
            'amount' => $this->amount,
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
        $title = 'dbTitleShipmentCompensationRejected';
        $content = 'dbBodyShipmentCompensationRejected';

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => 'shipment_compensation_rejected',
            'shipment_id' => $this->shipmentId,
            'order_number' => $this->trackingNumber,
            'amount' => $this->amount,
            'role' => $this->role
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
