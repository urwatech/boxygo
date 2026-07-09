<?php

namespace App\Notifications;

use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use App\Notifications\Concerns\LocalizedFcm;

class ShipmentReturnRDFDeductNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use LocalizedFcm;
    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly int $amount
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

        $title = $this->fcmTranslate($notifiable, 'dbTitleShipmentReturnedRDFDeduct');
        $body = $this->fcmTranslate($notifiable, 'dbBodyShipmentReturnedRDFDeduct', [
            'trackingNumber' => $this->trackingNumber,
        ]);

        $data = [
            'type' => 'shipment',
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
        $title = 'dbTitleShipmentReturnedRDFDeduct';
        $content = 'dbBodyShipmentReturnedRDFDeduct';

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => 'shipment_rdf_deduct',
            'type' => 'shipment',
            'shipment_id' => $this->shipmentId,
            'order_number' => $this->trackingNumber,
            'amount' => $this->amount,
            'role' => 'sender'
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
