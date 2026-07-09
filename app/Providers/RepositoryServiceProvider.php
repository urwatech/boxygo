<?php

namespace App\Providers;

use App\Contracts\AddressRepositoryInterface;
use App\Contracts\AddressServiceInterface;
use App\Contracts\CustomerAuthServiceInterface;
use App\Contracts\EmployeeRepositoryInterface;
use App\Contracts\EmployeeServiceInterface;
use App\Contracts\ParcelRepositoryInterface;
use App\Contracts\ParcelServiceInterface;
use App\Contracts\RatingRepositoryInterface;
use App\Contracts\RatingServiceInterface;
use App\Contracts\RoleRepositoryInterface;
use App\Contracts\RoleServiceInterface;
use App\Contracts\ShelfRepositoryInterface;
use App\Contracts\ShelfServiceInterface;
use App\Contracts\ShipmentRepositoryInterface;
use App\Contracts\ShipmentServiceInterface;
use App\Contracts\UserRepositoryInterface;
use App\Contracts\UserServiceInterface;
use App\Contracts\VehicleRepositoryInterface;
use App\Contracts\VehicleServiceInterface;
use App\Contracts\ZoneRepositoryInterface;
use App\Contracts\ZoneServiceInterface;
use App\Repositories\AddressRepository;
use App\Repositories\EmployeeRepository;
use App\Repositories\ParcelRepository;
use App\Repositories\RatingRepository;
use App\Repositories\RoleRepository;
use App\Repositories\ShelfRepository;
use App\Repositories\ShipmentRepository;
use App\Repositories\UserRepository;
use App\Repositories\VehicleRepository;
use App\Repositories\ZoneRepository;
use App\Services\AddressService;
use App\Services\CustomerAuthService;
use App\Services\EmployeeService;
use App\Services\ParcelService;
use App\Services\RatingService;
use App\Services\RoleService;
use App\Services\ShelfService;
use App\Services\ShipmentService;
use App\Services\UserService;
use App\Services\VehicleService;
use App\Services\ZoneService;
use Illuminate\Support\ServiceProvider;

/**
 * Bind repository and service interfaces to implementations.
 */
class RepositoryServiceProvider extends ServiceProvider
{
    /**
     * Register services in the container.
     */
    public function register(): void
    {
        // User bindings
        $this->app->bind(UserRepositoryInterface::class, UserRepository::class);
        $this->app->bind(UserServiceInterface::class, UserService::class);
        $this->app->bind(CustomerAuthServiceInterface::class, CustomerAuthService::class);

        // Role bindings
        $this->app->bind(RoleRepositoryInterface::class, RoleRepository::class);
        $this->app->bind(RoleServiceInterface::class, RoleService::class);

        // Employee bindings
        $this->app->bind(EmployeeRepositoryInterface::class, EmployeeRepository::class);
        $this->app->bind(EmployeeServiceInterface::class, EmployeeService::class);

        // Zone bindings
        $this->app->bind(ZoneRepositoryInterface::class, ZoneRepository::class);
        $this->app->bind(ZoneServiceInterface::class, ZoneService::class);

        // Parcel bindings
        $this->app->bind(ParcelRepositoryInterface::class, ParcelRepository::class);
        $this->app->bind(ParcelServiceInterface::class, ParcelService::class);

        // Vehicle bindings
        $this->app->bind(VehicleRepositoryInterface::class, VehicleRepository::class);
        $this->app->bind(VehicleServiceInterface::class, VehicleService::class);

        // Address bindings
        $this->app->bind(AddressRepositoryInterface::class, AddressRepository::class);
        $this->app->bind(AddressServiceInterface::class, AddressService::class);

        // Shipment bindings
        $this->app->bind(ShipmentRepositoryInterface::class, ShipmentRepository::class);
        $this->app->bind(ShipmentServiceInterface::class, ShipmentService::class);

        // Shelf bindings
        $this->app->bind(ShelfRepositoryInterface::class, ShelfRepository::class);
        $this->app->bind(ShelfServiceInterface::class, ShelfService::class);

        // Rating bindings
        $this->app->bind(RatingRepositoryInterface::class, RatingRepository::class);
        $this->app->bind(RatingServiceInterface::class, RatingService::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
