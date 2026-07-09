<?php

use App\Enums\Role;
use App\Http\Controllers\Api\V1\Auth\LoginController;
use App\Http\Controllers\Api\V1\Auth\OtpVerificationController;
use App\Http\Controllers\Api\V1\Auth\PasswordResetController;
use App\Http\Controllers\Api\V1\Auth\RegistrationController;
use App\Http\Controllers\Api\V1\CityController;
use App\Http\Controllers\Api\V1\InfoController;
use App\Http\Controllers\Api\V1\JobController;
use App\Http\Controllers\Api\V1\LocationController;
use App\Http\Controllers\Api\V1\MileageController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\RatingController;
use App\Http\Controllers\Api\V1\ShelfController;
use App\Http\Controllers\Api\V1\ShipmentPriceController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\VehicleController;
use App\Http\Controllers\Api\V1\ZoneController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('auth/register', [RegistrationController::class, 'store']);
    Route::post('auth/verify-otp', [OtpVerificationController::class, 'store']);
    Route::post('auth/resend-otp', [OtpVerificationController::class, 'resend']);
    Route::post('auth/login', [LoginController::class, 'store']);
    Route::post('auth/forgot-password', [PasswordResetController::class, 'sendResetLink']);
    Route::post('auth/verify-reset-code', [PasswordResetController::class, 'verifyCode']);
    Route::post('auth/resend-reset-code', [PasswordResetController::class, 'resendCode']);
    Route::post('auth/reset-password', [PasswordResetController::class, 'reset']);

    // Static informational endpoints for mobile clients
    Route::get('terms', [InfoController::class, 'terms']);
    Route::get('policy', [InfoController::class, 'policy']);
    Route::get('help-support', [InfoController::class, 'helpSupport']);
    Route::get('cities', [CityController::class, 'index']);
    // Check for a city existence with optional state/governorate filter
    Route::get('cities/check', [CityController::class, 'check']);

    // Check if coordinates fall within any active zone
    Route::get('zones/check', [ZoneController::class, 'check']);

    // Test Wallet
    Route::post('update-wallet', [UserController::class, 'updateWalletTest']);

    // Location search endpoints
    Route::get('locations/search/google', [LocationController::class, 'searchGoogle']);

    Route::middleware(['auth:sanctum', 'active.user'])->group(function () {
        Route::post('auth/logout', [LoginController::class, 'destroy']);
        Route::post('auth/change-password', [PasswordResetController::class, 'changePassword']);

        Route::apiResource('vehicles', VehicleController::class)->only(['index', 'store']);

        // Job/Shipment routes
        Route::prefix('jobs')->group(function () {
            Route::get('/valid-statuses', [JobController::class, 'getValidStatuses']);
            Route::get('/', [JobController::class, 'index']); // /jobs?filter=assigned|completed|all
            Route::get('/{id}', [JobController::class, 'show']);
            Route::post('/cancelled', [JobController::class, 'cancelledShipment']);
            Route::get('/{id}/timeline', [JobController::class, 'getTimeline']);
            Route::get('/{id}/active-users', [JobController::class, 'getActiveUsers']);
            Route::put('/{id}', [JobController::class, 'updateStatus']);
            Route::patch('/{id}/barcode', [JobController::class, 'updateBarcode']);
            Route::post('/collect/payment', [JobController::class, 'collectPayment']);
            Route::post('/scan-parcel/{id?}', [JobController::class, 'scanParcel']);
        });

        // Shipment price calculator
        Route::post('shipments/calculate-price', [ShipmentPriceController::class, 'calculate']);

        // Shelf management routes (restricted to drop point keeper and warehouse keeper roles)
        Route::prefix('shelves')->middleware(['role:'.Role::DROP_POINT_KEEPER->value.'|'.Role::WAREHOUSE_KEEPER->value])->group(function () {
            Route::get('/', [ShelfController::class, 'index']);
            Route::post('/assign', [ShelfController::class, 'assign']);
        });

        // User profile routes
        Route::get('auth/me', [UserController::class, 'me']);
        Route::put('user/profile', [UserController::class, 'updateProfile']);
        Route::get('user/nearest-drop-point-keeper', [UserController::class, 'nearestDropPointKeeper']);
        Route::get('user/documents', [UserController::class, 'getDocuments']);
        Route::post('user/documents', [UserController::class, 'updateDocuments']);
        Route::post('user/profile-picture', [UserController::class, 'updateProfilePicture']);
        Route::get('user/earnings', [UserController::class, 'earnings']);
        Route::post('user/deposit-cash', [UserController::class, 'depositCash']);

        // Notification routes
        Route::prefix('notifications')->group(function () {
            Route::get('/', [NotificationController::class, 'index']);
            Route::put('/{id}/read', [NotificationController::class, 'markAsRead']);
            Route::post('/read-all', [NotificationController::class, 'markAllAsRead']);
        });

        // Mileage tracking routes
        Route::prefix('mileage')->group(function () {
            Route::get('/stats', [MileageController::class, 'getMyMileage']);
            Route::get('/logs', [MileageController::class, 'getMileageLogs']);
            Route::get('/daily-summary', [MileageController::class, 'getDailySummary']);
            Route::get('/shipment/{shipmentId}', [MileageController::class, 'getShipmentMileage']);
        });

        // Ratings route
        Route::get('ratings', [RatingController::class, 'index']);
    });
});

Route::get('/debug-damascus-price', function () {
    $mappedName = 'Damascus City';

    return [
        'prices_from_damascus' => \App\Models\CityShipmentPrice::where('sender_sub_district_name', 'LIKE', '%'.$mappedName.'%')
            ->where('receiver_sub_district_name', 'LIKE', '%'.$mappedName.'%')
            ->get(),
        'damascus_city_model' => \App\Models\City::where('name', 'Damascus')->first(),
    ];
});
