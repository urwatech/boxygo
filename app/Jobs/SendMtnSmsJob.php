<?php

namespace App\Jobs;

use App\Services\MtnSmsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;

class SendMtnSmsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly string $phone,
        public readonly string $message,
        public readonly string $type = 'general',
    ) {}

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(MtnSmsService $smsService): void
    {
        if (!$smsService->sendNow($this->phone, $this->message, $this->type)) {
            throw new RuntimeException('MTN SMS sending failed.');
        }
    }
}
