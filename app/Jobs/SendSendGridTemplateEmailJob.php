<?php

namespace App\Jobs;

use App\Services\SendGridEmailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;

class SendSendGridTemplateEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly string $toEmail,
        public readonly string $toName,
        public readonly string $templateId,
        public readonly array $dynamicData = [],
        public readonly ?string $fromEmail = null,
        public readonly ?string $fromName = null,
    ) {}

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    public function handle(SendGridEmailService $emailService): void
    {
        $sent = $emailService->sendTemplateEmailNow(
            $this->toEmail,
            $this->toName,
            $this->templateId,
            $this->dynamicData,
            $this->fromEmail,
            $this->fromName
        );

        if (! $sent) {
            throw new RuntimeException('SendGrid template email sending failed.');
        }
    }
}
