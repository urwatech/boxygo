<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class DeliveryRiderRequiredNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly string $deliveryMode // 'door_to_door' or 'drop_point_to_door'
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $bodyKey = $this->deliveryMode === 'door_to_door'
            ? 'dbBodyDeliveryRiderRequiredDoorToDoor'
            : 'dbBodyDeliveryRiderRequiredDropPointToDoor';

        return [
            'title' => 'dbTitleDeliveryRiderRequired',
            'content' => $bodyKey,
            'notification_type' => 'delivery_rider_required',
            'icon' => 'delivery_rider_required',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
            'delivery_mode' => $this->deliveryMode,
        ];
    }

    public function toDatabase(object $notifiable): array
    {
        return $this->toArray($notifiable);
    }
}
