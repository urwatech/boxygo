<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class CheckFcmTokens extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notification:check-fcm';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check FCM token statistics for users';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('📊 FCM Token Statistics');
        $this->newLine();

        // Total users
        $totalUsers = User::count();
        $this->info("Total users: {$totalUsers}");

        // Users with FCM tokens
        $usersWithTokens = User::whereNotNull('fcm_token')->count();
        $this->info("Users with FCM tokens: {$usersWithTokens}");

        // Users with push notifications enabled
        $pushEnabled = User::where('push_notifications', true)->count();
        $this->info("Users with push notifications enabled: {$pushEnabled}");

        // Users ready to receive (has token AND push enabled)
        $readyToReceive = User::whereNotNull('fcm_token')
            ->where('push_notifications', true)
            ->count();
        $this->info("✅ Users ready to receive push: {$readyToReceive}");

        $this->newLine();

        // Device type breakdown
        $this->info('📱 Device Type Breakdown:');
        $deviceStats = User::whereNotNull('fcm_token')
            ->selectRaw('device_type, COUNT(*) as count')
            ->groupBy('device_type')
            ->get();

        $this->table(
            ['Device Type', 'Count'],
            $deviceStats->map(fn ($stat) => [
                $stat->device_type ?? 'Unknown',
                $stat->count,
            ])
        );

        $this->newLine();

        // Role breakdown
        $this->info('👥 Users with FCM by Role:');
        $roleStats = User::whereNotNull('fcm_token')
            ->with('roles')
            ->get()
            ->groupBy(function ($user) {
                return $user->roles->pluck('name')->first() ?? 'No Role';
            })
            ->map(fn ($users) => $users->count());

        $this->table(
            ['Role', 'Count'],
            $roleStats->map(fn ($count, $role) => [$role, $count])
        );

        $this->newLine();

        // Recent tokens (last 7 days)
        $recentTokens = User::whereNotNull('fcm_token')
            ->where('updated_at', '>=', now()->subDays(7))
            ->count();
        $this->info("📅 Tokens updated in last 7 days: {$recentTokens}");

        // Sample users
        if ($readyToReceive > 0) {
            $this->newLine();
            $this->info('📋 Sample users ready to receive (first 5):');
            $sampleUsers = User::whereNotNull('fcm_token')
                ->where('push_notifications', true)
                ->limit(5)
                ->get(['id', 'name', 'device_type', 'fcm_token', 'updated_at']);

            $this->table(
                ['ID', 'Name', 'Device', 'Token (truncated)', 'Last Updated'],
                $sampleUsers->map(fn ($u) => [
                    $u->id,
                    $u->name,
                    $u->device_type ?? 'N/A',
                    substr($u->fcm_token, 0, 30).'...',
                    $u->updated_at->diffForHumans(),
                ])
            );
        }

        $this->newLine();
        $this->info('💡 Tip: Use "php artisan notification:test-push {user_id}" to send a test notification');

        return 0;
    }
}
