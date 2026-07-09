<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\DeliveryAssignedNotification;
use App\Services\FcmService;
use Illuminate\Console\Command;

class TestPushNotification extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notification:test-push
                            {user_id? : The ID of the user to send test notification to}
                            {--all : Send to all users with FCM tokens}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test push notification system by sending a test notification';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $fcmService = app(FcmService::class);

        if ($this->option('all')) {
            // Send to all users with FCM tokens
            $users = User::whereNotNull('fcm_token')
                ->where('push_notifications', true)
                ->get();

            $this->info("Found {$users->count()} users with FCM tokens and push notifications enabled");

            if (!$this->confirm('Do you want to send test notification to all these users?')) {
                $this->info('Cancelled.');
                return;
            }

            $successCount = 0;
            $failCount = 0;

            $bar = $this->output->createProgressBar($users->count());
            $bar->start();

            foreach ($users as $user) {
                $result = $fcmService->sendNotification(
                    $user->fcm_token,
                    'Test Notification',
                    'This is a test push notification from your delivery system.',
                    ['type' => 'test', 'test_time' => now()->toDateTimeString()]
                );

                if ($result) {
                    $successCount++;
                } else {
                    $failCount++;
                }

                $bar->advance();
            }

            $bar->finish();
            $this->newLine(2);

            $this->info("✅ Successfully sent: {$successCount}");
            if ($failCount > 0) {
                $this->error("❌ Failed: {$failCount}");
            }

            return;
        }

        // Send to specific user
        $userId = $this->argument('user_id');

        if (!$userId) {
            // Show users with FCM tokens
            $users = User::whereNotNull('fcm_token')
                ->where('push_notifications', true)
                ->limit(10)
                ->get(['id', 'name', 'fcm_token', 'device_type']);

            if ($users->isEmpty()) {
                $this->error('No users found with FCM tokens!');
                return 1;
            }

            $this->info('Users with FCM tokens (showing first 10):');
            $this->table(
                ['ID', 'Name', 'Device Type', 'FCM Token (truncated)'],
                $users->map(fn($u) => [
                    $u->id,
                    $u->name,
                    $u->device_type ?? 'N/A',
                    substr($u->fcm_token, 0, 30) . '...'
                ])
            );

            $userId = $this->ask('Enter user ID to send test notification');
        }

        $user = User::find($userId);

        if (!$user) {
            $this->error("User with ID {$userId} not found!");
            return 1;
        }

        if (!$user->fcm_token) {
            $this->error("User {$user->name} does not have an FCM token!");
            return 1;
        }

        if (!$user->push_notifications) {
            $this->warn("User {$user->name} has push notifications disabled!");
            if (!$this->confirm('Send anyway?')) {
                return 0;
            }
        }

        $this->info("Sending test notification to: {$user->name} (ID: {$user->id})");
        $this->info("Device type: " . ($user->device_type ?? 'Unknown'));
        $this->info("FCM Token: " . substr($user->fcm_token, 0, 40) . '...');
        $this->newLine();

        // Test 1: Direct FCM Service
        $this->info('📱 Test 1: Sending via FcmService directly...');
        $result = $fcmService->sendNotification(
            $user->fcm_token,
            'Direct FCM Test',
            'This is a direct test from FcmService',
            [
                'type' => 'test',
                'method' => 'direct',
                'timestamp' => now()->toDateTimeString()
            ]
        );

        if ($result) {
            $this->info('✅ Direct FCM test notification sent successfully!');
        } else {
            $this->error('❌ Failed to send direct FCM notification. Check logs for details.');
        }

        $this->newLine();

        // Test 2: Via Laravel Notification
        $this->info('📬 Test 2: Sending via Laravel Notification system...');
        try {
            $user->notify(new DeliveryAssignedNotification(
                shipmentId: 'TEST-123',
                trackingNumber: 'TEST-TRK-' . now()->format('His'),
                assignedBy: 'Test Admin'
            ));
            $this->info('✅ Laravel notification sent successfully!');
        } catch (\Exception $e) {
            $this->error('❌ Failed to send Laravel notification: ' . $e->getMessage());
        }

        $this->newLine();
        $this->info('🔍 Check your mobile device for notifications!');
        $this->info('📋 Check logs: tail -f storage/logs/laravel.log | grep FCM');

        return 0;
    }
}
