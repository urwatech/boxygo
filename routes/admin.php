<?php

use App\Enums\Role;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SuperAdmin\DashboardController;
use App\Http\Controllers\SuperAdmin\EmployeeController;
use App\Http\Controllers\SuperAdmin\LoginController;
use App\Http\Controllers\SuperAdmin\ParcelController;
use App\Http\Controllers\SuperAdmin\RoleController;
use App\Http\Controllers\SuperAdmin\SettingsController;
use App\Http\Controllers\SuperAdmin\ShipmentTrackingController;
use App\Http\Controllers\SuperAdmin\ZoneController;
use App\Http\Controllers\SuperAdmin\VehicleController;
use App\Http\Controllers\SuperAdmin\EarningSummaryController;
use App\Http\Controllers\SuperAdmin\CodManagementController;
use App\Http\Controllers\SuperAdmin\PricingController;
use App\Http\Controllers\SuperAdmin\HeatmapController;
use App\Http\Controllers\SuperAdmin\WarehouseController;
use App\Http\Controllers\SuperAdmin\RatingManagementController;
use App\Http\Controllers\SuperAdmin\CustomerController;
use App\Http\Controllers\SuperAdmin\DropPointController;
use App\Http\Controllers\SuperAdmin\NotificationController;

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
|
| Here are the routes for admin panel. All routes are prefixed with /admin
| and require authentication with superadmin role.
|
*/

// Guest Routes (Authentication)
Route::prefix('admin')->as('admin.')->middleware(['guest', 'inertia.superadmin'])->group(function () {
    Route::get('/login', [LoginController::class, 'create'])->name('login');
    Route::post('/login', [LoginController::class, 'store'])->name('login.store');
});

// Authenticated Routes
Route::prefix('admin')->as('admin.')->middleware(['auth', 'inertia.superadmin'])->group(function () {

    Route::get('/', [DashboardController::class, 'landing'])->name('home');

    // Notifications
    Route::get('notifications', [NotificationController::class, 'index'])->name('notifications.index');
    Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount'])->name('notifications.unread-count');
    Route::put('notifications/{id}/read', [NotificationController::class, 'markAsRead'])->name('notifications.mark-read');
    Route::post('notifications/read-all', [NotificationController::class, 'markAllAsRead'])->name('notifications.mark-all-read');

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/dashboard/stats', [DashboardController::class, 'getStats'])->name('dashboard.stats');

    // Authentication
    Route::post('/logout', [LoginController::class, 'destroy'])->name('logout');

    // Settings
    Route::get('/settings', [SettingsController::class, 'index'])->name('settings');
    Route::put('/settings/profile', [SettingsController::class, 'updateProfile'])->name('settings.profile');
    Route::put('/settings/password', [SettingsController::class, 'updatePassword'])->name('settings.password');
    Route::put('/settings/financial', [SettingsController::class, 'updateFinancial'])->name('settings.financial');
    Route::put('/settings/terms', [SettingsController::class, 'updateTerms'])->name('settings.terms');
    Route::put('/settings/language', [SettingsController::class, 'updateLanguage'])->name('settings.language');

    // Role Management
    Route::resource('roles', RoleController::class)->except(['show']);

    // Employee Management
    Route::patch('employees/{employee}/status', [EmployeeController::class, 'toggleStatus'])->name('employees.status');
    Route::resource('employees', EmployeeController::class)->except(['create', 'edit']);

    // Customer Management
    Route::get('customers', [CustomerController::class, 'index'])->name('customers.index');

    // Warehouse Management
    Route::resource('warehouses', WarehouseController::class)->only(['index', 'store', 'update', 'destroy']);

    // Drop Points
    Route::get('drop-points/preview', [DropPointController::class, 'previewExtDropPoints'])->name('drop-points.preview');
    Route::post('drop-points/sync', [DropPointController::class, 'sync'])->name('drop-points.sync');
    Route::resource('drop-points', DropPointController::class)->only(['index', 'store', 'update', 'destroy']);

    // Zone Management
    Route::get('zones/map-full-view', [ZoneController::class, 'mapFullView'])->name('zones.map-full-view');
    Route::get('zones/api/cities', [ZoneController::class, 'getCities'])->name('zones.api.cities');
    Route::get('zones/api/locations/{city}', [ZoneController::class, 'getLocationsByCity'])->name('zones.api.locations');
    Route::get('zones/details', [ZoneController::class, 'details'])->name('zones.details');
    Route::patch('zones/{zone}/status', [ZoneController::class, 'toggleStatus'])->name('zones.status');
    Route::post('zones/sync', [ZoneController::class, 'sync'])->name('zones.sync');
    Route::post('zones/sync-prices', [ZoneController::class, 'syncPrices'])->name('zones.sync-prices');
    Route::get('zones/preview', [ZoneController::class, 'previewExtZones'])->name('zones.preview');
    Route::get('zones/{zone}/api-preview', [ZoneController::class, 'apiPreviewSingle'])->name('zones.api-preview-single');
    Route::get('zones/sync-progress', [ZoneController::class, 'getSyncProgress'])->name('zones.sync-progress');
    Route::get('zones/details', [ZoneController::class, 'getZoneResources']);
    Route::resource('zones', ZoneController::class)->only(['index', 'store', 'update', 'destroy']);

    // Parcel Management
    Route::patch('parcels/{parcel}/status', [ParcelController::class, 'updateStatus'])->name('parcels.status');
    Route::resource('parcels', ParcelController::class)->only(['index', 'store', 'update', 'destroy']);

    // Shipment Assignment
    Route::patch('shipments/{shipment}/assign-rider', [DashboardController::class, 'assignRider'])->name('shipments.assign-rider');
    Route::patch('shipments/{shipment}/unassign-rider', [DashboardController::class, 'unassignRider'])->name('shipments.unassign-rider');
    Route::patch('shipments/{shipment}/assign-delivery-rider', [DashboardController::class, 'assignDeliveryRider'])->name('shipments.assign-delivery-rider');
    Route::patch('shipments/{shipment}/unassign-delivery-rider', [DashboardController::class, 'unassignDeliveryRider'])->name('shipments.unassign-delivery-rider');
    Route::patch('shipments/{shipment}/admin-notes', [DashboardController::class, 'updateAdminNotes'])->name('shipments.admin-notes');

    // Shipment Tracking
    Route::get('shipments/{shipment}/tracking', [ShipmentTrackingController::class, 'show'])->name('shipments.tracking');
    Route::get('shipments/{shipment}/timeline', [ShipmentTrackingController::class, 'getTimeline'])->name('shipments.timeline');
    Route::get('shipments/{shipment}/assignments', [ShipmentTrackingController::class, 'getAssignments'])->name('shipments.assignments');
    Route::get('shipments/{shipment}/status-history', [ShipmentTrackingController::class, 'getStatusHistory'])->name('shipments.status-history');

    // Vehicle Management
    Route::get('vehicles', [VehicleController::class, 'index'])->name('vehicles.index');
    Route::post('vehicles', [VehicleController::class, 'store'])->name('vehicles.store');
    Route::put('vehicles/{vehicle}', [VehicleController::class, 'update'])->name('vehicles.update');
    Route::put('vehicles/{vehicle}/details', [VehicleController::class, 'updateDetails'])->name('vehicles.update-details');
    Route::patch('vehicles/{vehicle}/assign', [VehicleController::class, 'assign'])->name('vehicles.assign');

    // Earnings Summary
    Route::get('wallets', [EarningSummaryController::class, 'index'])->name('wallet.index');
    Route::get('wallets/transactions/{walletId}', [EarningSummaryController::class, 'getTransactions']);

    // COD Management
    Route::get('cod-management', [CodManagementController::class, 'index'])->name('cod-management.index');
    Route::get('cod-management/{id}', [CodManagementController::class, 'show'])->name('cod-management.show');
    Route::patch('cod-management/{id}/collect', [CodManagementController::class, 'markAsCollected'])->name('cod-management.collect');

    // Pricing Management
    Route::get('pricing', [PricingController::class, 'index'])->name('pricing.index');
    Route::get('pricing/export', [PricingController::class, 'export'])->name('pricing.export');

    // Heatmap
    Route::get('heatmap', [HeatmapController::class, 'index'])->name('heatmap.index');
    Route::get('live-tracking', [HeatmapController::class, 'live_tracking'])->name('live-tracking.index');

    // Rating Management
    Route::get('ratings', [RatingManagementController::class, 'index'])->name('ratings.index');
    Route::get('ratings/export', [RatingManagementController::class, 'export'])->name('ratings.export');
});
