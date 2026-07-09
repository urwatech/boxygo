<?php

namespace App\Notifications;

use App\Notifications\Concerns\LocalizedFcm;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class EarningsUpdateNotification extends Notification implements ShouldQueue
{
    use LocalizedFcm;
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public readonly float $amount,
        public readonly string $period
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
        $title = 'dbTitleEarningsUpdate';
        $content = 'dbBodyEarningsUpdate';
        $date = now()->format('M d');

        return [
            'title' => $title,
            'content' => $content,
            'notification_type' => 'earnings',
            'icon' => 'dollar_circle',
            'amount' => $this->amount,
            'period' => $this->period,
            'date' => $date,
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
