<?php

namespace App\Services;

use App\Jobs\SendSendGridTemplateEmailJob;
use Illuminate\Support\Facades\Log;
use SendGrid;
use SendGrid\Mail\Mail as SendGridMail;
use Throwable;

class SendGridEmailService
{
    private ?SendGrid $sendgrid = null;

    public function __construct()
    {
        $apiKey = config('services.sendgrid.api_key');
        if ($apiKey) {
            $this->sendgrid = new SendGrid($apiKey);
        }
    }

    /**
     * Send an email using SendGrid template
     *
     * @param string $toEmail Recipient email address
     * @param string $toName Recipient name
     * @param string $templateId SendGrid template ID
     * @param array $dynamicData Dynamic template data
     * @param string|null $fromEmail Override from email (optional)
     * @param string|null $fromName Override from name (optional)
     * @return bool Success status
     */
    public function sendTemplateEmail(
        string $toEmail,
        string $toName,
        string $templateId,
        array $dynamicData = [],
        ?string $fromEmail = null,
        ?string $fromName = null
    ): bool {
        if (trim($toEmail) === '' || trim($templateId) === '') {
            Log::warning('SendGrid email: Skipped queueing empty email payload', [
                'to' => $toEmail,
                'template_id' => $templateId,
            ]);
            return false;
        }

        SendSendGridTemplateEmailJob::dispatch(
            $toEmail,
            $toName,
            $templateId,
            $dynamicData,
            $fromEmail,
            $fromName
        );

        Log::info('SendGrid email queued for sending', [
            'to' => $toEmail,
            'template_id' => $templateId,
        ]);

        return true;
    }

    /**
     * Send an email immediately. Queue jobs call this method.
     */
    public function sendTemplateEmailNow(
        string $toEmail,
        string $toName,
        string $templateId,
        array $dynamicData = [],
        ?string $fromEmail = null,
        ?string $fromName = null
    ): bool {
        if (!$this->sendgrid) {
            Log::error('SendGrid is not configured. Please set SENDGRID_API_KEY in your environment.');
            return false;
        }

        try {
            $email = new SendGridMail();

            // Set from address
            $email->setFrom(
                $fromEmail ?? config('mail.from.address'),
                $fromName ?? config('mail.from.name')
            );

            // Set recipient
            $email->addTo($toEmail, $toName);

            // Set template ID
            $email->setTemplateId($templateId);

            // Add dynamic template data
            if (!empty($dynamicData)) {
                $email->addDynamicTemplateDatas($dynamicData);
            }

            // Send email
            $response = $this->sendgrid->send($email);

            // Capture full response details
            $statusCode = $response->statusCode();
            $responseBody = $response->body();
            $responseHeaders = $response->headers();

            // Log successful response with full details
            Log::info('SendGrid email sent successfully', [
                'to' => $toEmail,
                'template_id' => $templateId,
                'status_code' => $statusCode,
                'response_body' => $responseBody,
                'response_headers' => $responseHeaders,
                'dynamic_data' => $dynamicData,
            ]);

            // Check for errors
            if ($statusCode >= 400) {
                Log::error('SendGrid returned error status code', [
                    'to' => $toEmail,
                    'template_id' => $templateId,
                    'status_code' => $statusCode,
                    'response_body' => $responseBody,
                    'response_headers' => $responseHeaders,
                    'dynamic_data' => $dynamicData,
                ]);
                return false;
            }

            return true;
        } catch (Throwable $exception) {
            Log::error('Failed to send SendGrid email', [
                'to' => $toEmail,
                'template_id' => $templateId,
                'dynamic_data' => $dynamicData,
                'exception' => $exception->getMessage(),
                'exception_class' => get_class($exception),
                'exception_code' => $exception->getCode(),
                'exception_file' => $exception->getFile(),
                'exception_line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * Send verification code email
     *
     * @param string $toEmail
     * @param string $toName
     * @param string $code
     * @return bool
     */
    public function sendVerificationCode(string $toEmail, string $toName, string $code): bool
    {
        $templateId = config('services.sendgrid.templates.verification_code');

        return $this->sendTemplateEmail(
            $toEmail,
            $toName,
            $templateId,
            [
                'code' => $code,
                'name' => $toName,
            ]
        );
    }

    /**
     * Send password reset code email
     *
     * @param string $toEmail
     * @param string $toName
     * @param string $code
     * @return bool
     */
    public function sendPasswordResetCode(string $toEmail, string $toName, string $code): bool
    {
        $templateId = config('services.sendgrid.templates.password_reset');

        return $this->sendTemplateEmail(
            $toEmail,
            $toName,
            $templateId,
            [
                'code' => $code,
                'name' => $toName,
            ]
        );
    }

    /**
     * Send employee invitation email with login credentials
     *
     * @param string $toEmail
     * @param string $toName
     * @param string $password
     * @param string $loginUrl
     * @param string|null $employeeId
     * @param string|null $role
     * @return bool
     */
    public function sendEmployeeInvitation(
        string $toEmail,
        string $toName,
        string $password,
        ?string $employeeId = null,
        ?string $role = null
    ): bool {
        $templateId = config('services.sendgrid.templates.employee_invitation');

        return $this->sendTemplateEmail(
            $toEmail,
            $toName,
            $templateId,
            [
                'name' => $toName,
                'email' => $toEmail,
                'password' => $password,
                'employee_id' => $employeeId ?? 'N/A',
                'role' => $role ?? 'Employee',
                'app_name' => config('app.name'),
            ]
        );
    }

    /**
     * Send welcome email to new user
     *
     * @param string $toEmail
     * @param string $toName
     * @return bool
     */
    public function sendWelcomeEmail(string $toEmail, string $toName): bool
    {
        $templateId = config('services.sendgrid.templates.welcome_user');

        return $this->sendTemplateEmail(
            $toEmail,
            $toName,
            $templateId,
            [
                'name' => $toName,
                'app_name' => config('app.name'),
            ]
        );
    }

    /**
     * Send shipment verification code email
     *
     * @param string $toEmail
     * @param string $toName
     * @param string $verificationCode
     * @param int $shipmentId
     * @param string|null $receiverName
     * @return bool
     */
    public function sendShipmentVerificationCode(
        string $toEmail,
        string $toName,
        string $verificationCode,
        int $shipmentId,
        ?string $receiverName = null
    ): bool {
        $templateId = config('services.sendgrid.templates.shipment_verification');

        return $this->sendTemplateEmail(
            $toEmail,
            $toName,
            $templateId,
            [
                'name' => $toName,
                'receiver_name' => $receiverName ?? $toName,
                'verification_code' => $verificationCode,
                'shipment_id' => $shipmentId,
                'app_name' => config('app.name'),
            ]
        );
    }
}
