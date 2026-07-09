<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\FcmService;
use Illuminate\Console\Command;

class CleanInvalidFcmTokens extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notification:clean-invalid-tokens
                            {--dry-run : Show what would be cleaned without actually cleaning}
                            {--test : Test a specific token}
                            {token? : Specific token to test}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up invalid/expired FCM tokens by testing them';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        if ($this->option('test') || $this->argument('token')) {
            return $this->testToken();
        }

        $fcmService = app(FcmService::class);
        $isDryRun = $this->option('dry-run');

        if ($isDryRun) {
            $this->warn('🔍 DRY RUN MODE - No tokens will be removed');
            $this->newLine();
        }

        $this->info('🔍 Checking FCM tokens...');
        $this->newLine();

        $users = User::whereNotNull('fcm_token')->get();

        if ($users->isEmpty()) {
            $this->warn('No users with FCM tokens found.');
            return 0;
        }

        $this->info("Found {$users->count()} users with FCM tokens");
        $this->newLine();

        $invalidTokens = [];
        $validTokens = 0;
        $errors = [];

        $bar = $this->output->createProgressBar($users->count());
        $bar->start();

        foreach ($users as $user) {
            try {
                // Try to send a silent data-only message to test the token
                $result = $fcmService->sendNotification(
                    $user->fcm_token,
                    'Token Validation',
                    'Testing token validity',
                    ['type' => 'token_test', 'silent' => true]
                );

                if ($result) {
                    $validTokens++;
                } else {
                    // Check if it's an UNREGISTERED error
                    $invalidTokens[] = [
                        'user_id' => $user->id,
                        'name' => $user->name,
                        'token' => substr($user->fcm_token, 0, 30) . '...',
                        'device_type' => $user->device_type ?? 'Unknown',
                        'last_updated' => $user->updated_at->diffForHumans(),
                    ];
                }
            } catch (\Exception $e) {
                $errors[] = [
                    'user_id' => $user->id,
                    'name' => $user->name,
                    'error' => $e->getMessage(),
                ];
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        // Results
        $this->info('📊 Results:');
        $this->info("✅ Valid tokens: {$validTokens}");
        $this->error("❌ Invalid tokens: " . count($invalidTokens));
        if (count($errors) > 0) {
            $this->warn("⚠️  Errors during testing: " . count($errors));
        }

        $this->newLine();

        // Show invalid tokens
        if (!empty($invalidTokens)) {
            $this->error('Invalid/Expired Tokens Found:');
            $this->table(
                ['User ID', 'Name', 'Device Type', 'Token (truncated)', 'Last Updated'],
                array_map(fn($t) => [
                    $t['user_id'],
                    $t['name'],
                    $t['device_type'],
                    $t['token'],
                    $t['last_updated'],
                ], $invalidTokens)
            );

            $this->newLine();

            if ($isDryRun) {
                $this->warn('🔍 DRY RUN: Would remove ' . count($invalidTokens) . ' invalid tokens');
                $this->info('Run without --dry-run to actually clean them up');
            } else {
                if ($this->confirm('Do you want to remove these invalid tokens from the database?', true)) {
                    $userIds = array_column($invalidTokens, 'user_id');
                    User::whereIn('id', $userIds)->update([
                        'fcm_token' => null,
                        'device_type' => null,
                    ]);
                    $this->info('✅ Removed ' . count($invalidTokens) . ' invalid tokens');
                    $this->info('💡 Users will get new tokens when they login again from mobile app');
                } else {
                    $this->warn('Skipped removing tokens');
                }
            }
        } else {
            $this->info('✅ All tokens are valid!');
        }

        // Show errors if any
        if (!empty($errors)) {
            $this->newLine();
            $this->warn('⚠️  Errors During Testing:');
            $this->table(
                ['User ID', 'Name', 'Error'],
                array_map(fn($e) => [$e['user_id'], $e['name'], $e['error']], $errors)
            );
        }

        return 0;
    }

    private function testToken()
    {
        $token = $this->argument('token');

        if (!$token) {
            $this->error('Please provide a token to test');
            return 1;
        }

        $this->info('Testing FCM token...');
        $this->info('Token: ' . substr($token, 0, 50) . '...');
        $this->newLine();

        $fcmService = app(FcmService::class);

        try {
            $result = $fcmService->sendNotification(
                $token,
                'Test Notification',
                'Testing if this token is valid',
                ['type' => 'test']
            );

            if ($result) {
                $this->info('✅ Token is VALID - Notification sent successfully');
            } else {
                $this->error('❌ Token is INVALID or EXPIRED');
                $this->info('💡 Check logs for details: tail -f storage/logs/laravel.log | grep FCM');
            }
        } catch (\Exception $e) {
            $this->error('❌ Error testing token: ' . $e->getMessage());
        }

        return 0;
    }
}
