<?php

use App\Enums\Role;
use App\Models\Address;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Artisan;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\Customer\FaqController;
use App\Http\Controllers\Customer\TermsController;
use App\Http\Controllers\Customer\LoginController;
use App\Http\Controllers\Customer\UploadController;
use App\Http\Controllers\Customer\AddressController;
use App\Http\Controllers\Customer\BookingController;
use App\Http\Controllers\Customer\RegisterController;
use App\Http\Controllers\Customer\SettingsController;
use App\Http\Controllers\Customer\ShipmentController;
use App\Http\Controllers\Customer\WalletController;
use App\Http\Controllers\Customer\DashboardController;
use App\Http\Controllers\Customer\MockPaymentController;
use App\Http\Controllers\Customer\ForgotPasswordController;
use App\Http\Controllers\Customer\ReviewController as CustomerReviewController;
use App\Http\Controllers\Customer\OnlinePaymentController;
use App\Http\Controllers\Customer\ShipmentController as CustomerShipmentController;
use App\Http\Controllers\Customer\NotificationController as CustomerNotificationController;

/*
|--------------------------------------------------------------------------
| Customer Web Routes
|--------------------------------------------------------------------------
|
| Here are the routes for customer-facing website. These routes will be
| accessible to customers with 'customer' role.
|
*/


// Seed Permissiosn of RolesAndPermissionsSeeder
Route::get('seed-permissions', function () {
    Artisan::call('db:seed', [
        '--class' => 'RolesAndPermissionsSeeder',
        '--force' => true
    ]);
    return 'Permissions seeded';
});

Route::get('database-seed', function () {
    Artisan::call('db:seed', [
        '--force' => true
    ]);
    return 'Permissions seeded';
});


// Migrate

Route::get('migrate', function () {
    Artisan::call('migrate', ['--force' => true]);
    return 'Migration completed';
});
//
Route::get('storage-link', function () {
    Artisan::call('storage:link');
    return 'Storage link created';
});
Route::get('/debug-zone', function () {
    $zone = \App\Models\Zone::firstWhere('name', '!=', null);
    if ($zone) {
        return response()->json([
            'id' => $zone->id,
            'name' => $zone->name,
            'db_raw' => $zone->getAttributes()['drawn_paths'] ?? null,
            'casted' => $zone->drawn_paths
        ]);
    }
    return response()->json(['error' => 'No zone found']);
});
// Cache Clear Route
Route::get('/cache-clear', function () {
    $exitCode = Artisan::call('optimize:clear');
    return 'Cache cleared';
});

Route::get('/firebase-messaging-sw-config.js', function () {
    $config = array_filter(
        config('services.firebase.web', []),
        static fn ($value) => filled($value)
    );

    $script = 'self.firebaseMessagingConfig = ' . json_encode($config, JSON_UNESCAPED_SLASHES) . ';';

    return response($script, 200, [
        'Content-Type' => 'application/javascript; charset=UTF-8',
        'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
    ]);
})->name('firebase.messaging_sw_config');

// Test Push Notification Route
Route::get('/test-push-notification/{userId?}', function ($userId = 165) {
    try {
        $user = \App\Models\User::find($userId);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => "User with ID {$userId} not found"
            ], 404);
        }

        if (!$user->fcm_token) {
            return response()->json([
                'success' => false,
                'message' => "User {$user->name} (ID: {$userId}) does not have an FCM token",
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'push_notifications' => $user->push_notifications,
                ]
            ], 400);
        }

        if (!$user->push_notifications) {
            return response()->json([
                'success' => false,
                'message' => "User {$user->name} (ID: {$userId}) has push notifications disabled",
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'fcm_token' => substr($user->fcm_token, 0, 30) . '...',
                    'push_notifications' => $user->push_notifications,
                ]
            ], 400);
        }

        // Send test notification
        $user->notify(new \App\Notifications\DeliveryAssignedNotification(
            shipmentId: 'TEST-' . now()->format('YmdHis'),
            trackingNumber: 'TRK-TEST-' . $userId,
            assignedBy: 'Test Admin'
        ));

        return response()->json([
            'success' => true,
            'message' => "✅ Test notification sent successfully to {$user->name} (ID: {$userId})",
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'device_type' => $user->device_type,
                'fcm_token' => substr($user->fcm_token, 0, 30) . '...',
            ],
            'notification' => [
                'title' => 'New Delivery Assigned',
                'body' => "You have been assigned delivery #TRK-TEST-{$userId}. Tap to view details.",
                'type' => 'delivery_assigned',
            ],
            'next_steps' => [
                'Check the mobile device for notification',
                'Check logs: tail -f storage/logs/laravel.log | grep FCM',
                'If notification not received, check FCM token validity'
            ]
        ]);
    } catch (\Exception $e) {
        \Log::error('Test notification error', [
            'user_id' => $userId,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        return response()->json([
            'success' => false,
            'message' => 'Error sending notification',
            'error' => $e->getMessage(),
            'trace' => config('app.debug') ? $e->getTraceAsString() : null,
            'help' => 'Check storage/logs/laravel.log for details'
        ], 500);
    }
})->name('test.push.notification');

Route::get('/', [HomeController::class, 'index'])->name('home');

// Customer Authentication Routes
Route::middleware(['guest', 'inertia.customer'])->group(function () {
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('customer.login.store');

    // Registration + verification
    Route::get('/register', [RegisterController::class, 'create'])->name('customer.register');
    Route::post('/register', [RegisterController::class, 'store'])->name('customer.register.store');
    Route::get('/verify', [RegisterController::class, 'showVerify'])->name('customer.verify.show');
    Route::post('/verify', [RegisterController::class, 'verify'])->name('customer.verify.perform');
    Route::post('/verify/resend', [RegisterController::class, 'resend'])->name('customer.verify.resend');

    // Forgot/Reset Password (OTP-based flow)
    Route::get('/forgot-password', [ForgotPasswordController::class, 'create'])->name('customer.password.request');
    Route::post('/forgot-password', [ForgotPasswordController::class, 'store'])->name('customer.password.email');
    Route::get('/verify-reset-code', [ForgotPasswordController::class, 'showVerify'])->name('customer.password.verify.show');
    Route::post('/verify-reset-code', [ForgotPasswordController::class, 'verifyCode'])->name('customer.password.verify.perform');
    Route::post('/resend-reset-code', [ForgotPasswordController::class, 'resendCode'])->name('customer.password.resend');
    Route::get('/reset-password', [ForgotPasswordController::class, 'showReset'])->name('customer.password.reset.show');
    Route::post('/reset-password', [ForgotPasswordController::class, 'performReset'])->name('customer.password.update');
});

// Public shipment tracking (shared link)
Route::middleware(['inertia.customer'])->group(function () {
    Route::get('/track/{trackingNumber}', [ShipmentController::class, 'track'])->name('customer.shipments.track');
    Route::post('/shipments/{shipment}/return', [ShipmentController::class, 'requestReturn'])->name('customer.shipments.return');
});

// Customer Protected Routes
Route::middleware(['auth', 'role:' . Role::CUSTOMER->value, 'inertia.customer'])->group(function () {
    Route::get('/customer/dashboard', [DashboardController::class, 'index'])->name('customer.dashboard');

    // Settings
    Route::get('/customer/settings', [SettingsController::class, 'index'])->name('customer.settings');
    Route::put('/customer/settings/profile', [SettingsController::class, 'updateProfile'])->name('customer.settings.profile');
    Route::put('/customer/settings/password', [SettingsController::class, 'updatePassword'])->name('customer.settings.password');
    Route::put('/customer/settings/notification', [SettingsController::class, 'updateNotification'])->name('customer.settings.notification');
    Route::put('/customer/settings/language', [SettingsController::class, 'updateLanguage'])->name('customer.settings.language');
    Route::post('/customer/push-notifications/token', [SettingsController::class, 'storePushNotificationToken'])->name('customer.push_notifications.token.store');
    Route::delete('/customer/push-notifications/token', [SettingsController::class, 'destroyPushNotificationToken'])->name('customer.push_notifications.token.destroy');

    // Bookings
    Route::get('/customer/create-booking', [BookingController::class, 'create'])->name('customer.create_booking');

    // Wallet
    Route::get('/customer/wallet', [WalletController::class, 'index'])->name('customer.wallet');

    // RDF Mock Payment
    Route::get('/customer/mock-payment/{shipment}', [MockPaymentController::class, 'show'])->name('customer.mock-payment.show');
    Route::post('/customer/mock-payment/{shipment}', [MockPaymentController::class, 'process'])->name('customer.mock-payment.process');

    // Addresses
    Route::get('/customer/addresses', [AddressController::class, 'index'])->name('customer.addresses.index');
    Route::post('/customer/addresses', [AddressController::class, 'store'])->name('customer.addresses.store');
    Route::put('/customer/addresses/{address}', [AddressController::class, 'update'])->name('customer.addresses.update');
    Route::delete('/customer/addresses/{address}', [AddressController::class, 'destroy'])->name('customer.addresses.destroy');

    // Uploads
    Route::post('/customer/uploads/photo', [UploadController::class, 'storePhoto'])->name('customer.uploads.photo');
    Route::post('/customer/uploads/document', [UploadController::class, 'storeDocument'])->name('customer.uploads.document');

    // Mock Payment Complete
    Route::post('/customer/shipments/paynow', [ShipmentController::class, 'shipment_paynow']);

    // Shipments
    Route::get('/customer/shipments', [ShipmentController::class, 'index'])->name('customer.shipments.index');
    Route::get('/customer/sending-parcels', [ShipmentController::class, 'sending_parcels'])->name('customer.shipments.sending_parcels');
    Route::get('/customer/sending-parcels/{shipment}', [ShipmentController::class, 'sending_parcels_show'])->name('customer.shipments.sending_parcels_show');
    Route::get('/customer/receiving-parcels', [ShipmentController::class, 'receiving_parcels'])->name('customer.shipments.receiving_parcels');
    Route::get('/customer/receiving-parcels/{shipment}', [ShipmentController::class, 'receiving_parcels_show'])->name('customer.shipments.receiving_parcels_show');
    Route::get('/customer/shipments-return', [ShipmentController::class, 'return_index'])->name('customer.shipments.return_index');
    Route::post('/customer/shipments/return', [ShipmentController::class, 'store_return'])->name('customer.shipments.return_store');
    Route::post('/customer/shipments/{shipment}/cancel', [ShipmentController::class, 'cancel'])->name('customer.shipments.cancel');
    Route::get('/customer/shipments/{shipment}/rateable-actors', [\App\Http\Controllers\Customer\ReviewController::class, 'getRateableActors'])->name('customer.shipments.rateable_actors');
    Route::post('/customer/shipments', [ShipmentController::class, 'store'])->name('customer.shipments.store');
    Route::post('/customer/shipments/compensation', [ShipmentController::class, 'compensation_request'])->name('customer.shipments.compensation');
    Route::post('/customer/shipments/compensation-status', [ShipmentController::class, 'compensation_status'])->name('customer.shipments.componsation_status');
    Route::post('/customer/shipments/return-status', [ShipmentController::class, 'return_status'])->name('customer.shipments.approved_return');
    Route::get('/customer/shipments/{shipment}', [ShipmentController::class, 'show'])->name('customer.shipments.show');
    Route::post('/customer/shipments/calculate-price', [\App\Http\Controllers\Api\V1\ShipmentPriceController::class, 'calculate'])->name('customer.shipments.calculate_price');

    // FAQ
    Route::get('/customer/faq', [FaqController::class, 'index'])->name('customer.faq');

    // Terms and Conditions
    Route::get('/customer/terms-and-conditions', [TermsController::class, 'index'])->name('customer.terms');

    // Notifications
    Route::get('/customer/notifications', [CustomerNotificationController::class, 'index'])->name('customer.notifications.index');
    Route::get('/customer/notifications/unread-count', [CustomerNotificationController::class, 'unreadCount'])->name('customer.notifications.unread_count');
    Route::put('/customer/notifications/{id}/read', [CustomerNotificationController::class, 'markAsRead'])->name('customer.notifications.mark_as_read');
    Route::post('/customer/notifications/read-all', [CustomerNotificationController::class, 'markAllAsRead'])->name('customer.notifications.mark_all_as_read');


    // Logout
    Route::post('/logout', [LoginController::class, 'destroy'])->name('customer.logout');
});

// Online Payments — MTN
Route::post('/customer/payments/initiate', [OnlinePaymentController::class, 'initiate'])->name('customer.payments.initiate');
Route::post('/customer/payments/confirm', [OnlinePaymentController::class, 'confirm'])->name('customer.payments.confirm');
Route::post('/customer/payments/status', [OnlinePaymentController::class, 'status'])->name('customer.payments.status');

// Online Payments — Paymera (Card)
Route::post('/customer/payments/paymera/initiate', [OnlinePaymentController::class, 'initiatePaymera'])->name('customer.payments.paymera.initiate');
Route::get('/customer/payments/paymera/return', [OnlinePaymentController::class, 'paymeraReturn'])->name('customer.payments.paymera.return');

// Online Payments — Syriatel
Route::post('/customer/payments/syriatel/initiate', [OnlinePaymentController::class, 'initiateSyriatel'])->name('customer.payments.syriatel.initiate');
Route::post('/customer/payments/syriatel/confirm', [OnlinePaymentController::class, 'confirmSyriatel'])->name('customer.payments.syriatel.confirm');
Route::post('/customer/payments/syriatel/resend', [OnlinePaymentController::class, 'resendSyriatel'])->name('customer.payments.syriatel.resend');

// Paymera callback (called by Paymera server, no auth required)
Route::match(['get', 'post'], '/customer/payments/paymera/callback', [OnlinePaymentController::class, 'paymeraCallback'])
    ->name('customer.payments.paymera.callback');

// Customer shipment status update (direct/indirect) and review
Route::middleware(['web', 'auth'])
    ->post('/customer/shipments/{shipment}/status', [CustomerShipmentController::class, 'updateStatus'])
    ->name('customer.shipments.status');

Route::middleware(['web', 'auth'])
    ->post('/customer/shipments/{shipment}/review', [CustomerReviewController::class, 'store'])
    ->name('customer.shipments.review');

Route::middleware(['web', 'auth'])
    ->delete('/customer/account', [SettingsController::class, 'deleteAccount'])
    ->name('customer.account.delete');
