<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \Illuminate\Notifications\DatabaseNotification */
class NotificationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        // Determine if notification is clickable based on whether it has associated data with a reference
        $isClickable = !empty($this->data) && (
            isset($this->data['shipment_id']) ||
            isset($this->data['job_id']) ||
            isset($this->data['url']) ||
            isset($this->data['action'])
        );

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'content' => $this->content,
            'notification_type' => $this->notification_type,
            'icon' => $this->icon,
            'data' => $this->data,
            'is_clickable' => $isClickable,
            'read_at' => $this->read_at?->toIso8601String(),
            'is_read' => $this->read_at !== null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
