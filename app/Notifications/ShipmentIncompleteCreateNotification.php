<?php

namespace App\Notifications;

use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use App\Notifications\Concerns\LocalizedFcm;

class ShipmentIncompleteCreateNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use LocalizedFcm;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly string $remarks,
        public readonly string $initiateBy,
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

        $title = $this->fcmTranslate($notifiable, 'dbTitleShipmentIncompleteCreate');
        $body = $this->fcmTranslate($notifiable, 'dbBodyShipmentIncompleteCreate', [
            'remarks' => $this->remarks
        ]);

        $data = [
            'type' => 'incomplete_create',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'remarks' => $this->remarks,
            'initiate_by' => $this->initiateBy,
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
        $title = 'dbTitleShipmentIncompleteCreate';
        $content = 'dbBodyShipmentIncompleteCreate';

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => 'incomplete_create',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'remarks' => $this->remarks,
            'initiate_by' => $this->initiateBy,
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
