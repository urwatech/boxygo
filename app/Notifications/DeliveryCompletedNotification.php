<?php

namespace App\Notifications;

use App\Notifications\Concerns\LocalizedFcm;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class DeliveryCompletedNotification extends Notification implements ShouldQueue
{
    use LocalizedFcm;
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $title = 'dbTitleDeliveryCompleted';
        $content = 'dbBodyDeliveryCompleted';

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'delivery',
            'icon' => 'check_circle',
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
