<?php

namespace App\Channels;

use Illuminate\Notifications\Channels\DatabaseChannel;
use Illuminate\Notifications\Notification;

class ExtendedDatabaseChannel extends DatabaseChannel
{
    /**
     * Build an array payload for the DatabaseNotification Model.
     *
     * @param  mixed  $notifiable
     * @param  \Illuminate\Notifications\Notification  $notification
     * @return array
     */
    protected function buildPayload($notifiable, Notification $notification): array
    {
        $data = $this->getData($notifiable, $notification);

        return [
            'id' => $notification->id,
            'type' => get_class($notification),
            'title' => $data['title'] ?? null,
            'content' => $data['content'] ?? null,
            'notification_type' => $data['notification_type'] ?? null,
            'icon' => $data['icon'] ?? null,
            'data' => $data,
            'read_at' => null,
        ];
    }
}
