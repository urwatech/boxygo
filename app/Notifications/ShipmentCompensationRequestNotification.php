<?php

namespace App\Notifications;

use App\Notifications\Concerns\LocalizedFcm;
use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ShipmentCompensationRequestNotification extends Notification implements ShouldQueue
{
    use LocalizedFcm;
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly int $amount,
        public readonly ?string $remarks,
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

        $title = $this->fcmTranslate($notifiable, 'dbTitleShipmentCompensationRequest');
        $body = $this->fcmTranslate($notifiable, 'dbBodyShipmentCompensationRequest', [
            'trackingNumber' => $this->trackingNumber,
        ]);

        $data = [
            'type' => 'shipment_compensation_request',
            'shipment_id' => $this->shipmentId,
            'order_number' => $this->trackingNumber,
            'amount' => $this->amount,
            'reason' => $this->remarks,
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
        $title = 'dbTitleShipmentCompensationRequest';
        $content = 'dbBodyShipmentCompensationRequest';

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => 'shipment_compensation_request',
            'shipment_id' => $this->shipmentId,
            'order_number' => $this->trackingNumber,
            'amount' => $this->amount,
            'reason' => $this->remarks,
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
