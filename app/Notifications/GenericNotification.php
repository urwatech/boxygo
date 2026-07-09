<?php

namespace App\Notifications;

use App\Notifications\Concerns\LocalizedFcm;
use App\Services\FcmService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class GenericNotification extends Notification implements ShouldQueue
{
    use LocalizedFcm;
    use Queueable;

    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly string $title,
        public readonly string $description,
        public readonly string $type,
        public readonly string $icon,
        public readonly array $extraData = [],
        public readonly array $extraDataDescription = [],
    ) {}

    /**
     * Channels
     */
    public function via(object $notifiable): array
    {
        return ['database', 'fcm'];
    }

    /**
     * FCM Notification
     */
    public function toFcm(object $notifiable): void
    {
        if (! $notifiable->push_notifications || ! $notifiable->fcm_token) {
            return;
        }

        $fcmService = app(FcmService::class);

        $title = $this->fcmTranslate($notifiable, $this->title);
        $body = $this->fcmTranslate($notifiable, $this->description, array_merge($this->extraData, $this->extraDataDescription));

        $data = array_merge([
            'type' => $this->type,
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'click_action' => 'FLUTTER_NOTIFICATION_CLICK',
        ], $this->extraData);

        $fcmService->sendNotification(
            $notifiable->fcm_token,
            $title,
            $body,
            $data
        );
    }

    /**
     * Notification Array
     */
    public function toArray(object $notifiable): array
    {
        $title = $this->title;
        $content = $this->description;

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'shipment',
            'icon' => $this->icon,
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            ...$this->extraData,
        ];
    }

    /**
     * Database
     */
    public function toDatabase(object $notifiable): array
    {
        return $this->toArray($notifiable);
    }
}
