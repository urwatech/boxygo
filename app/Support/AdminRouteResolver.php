<?php

namespace App\Support;

use App\Models\User;

class AdminRouteResolver
{
    /**
     * Ordered list of admin routes with their required permissions.
     *
     * @return array<int, array{route: string, permissions: array<int, string>}>
     */
    public static function routes(): array
    {
        return [
            ['route' => 'admin.dashboard', 'permissions' => ['admin.access']],
            ['route' => 'admin.heatmap.index', 'permissions' => ['heatmap.view']],
            ['route' => 'admin.employees.index', 'permissions' => ['employees.manage', 'employees.view', 'employees.create']],
            ['route' => 'admin.customers.index', 'permissions' => ['customers.manage', 'customers.view']],
            ['route' => 'admin.earnings-summary.index', 'permissions' => ['earnings.manage', 'earnings.view']],
            ['route' => 'admin.zones.index', 'permissions' => ['zones.manage', 'zones.view', 'zones.create', 'zones.details']],
            ['route' => 'admin.drop-points.index', 'permissions' => ['drop_points.manage', 'drop_points.view', 'drop_points.create']],
            ['route' => 'admin.roles.index', 'permissions' => ['roles.manage', 'roles.view', 'roles.create']],
            ['route' => 'admin.parcels.index', 'permissions' => ['parcels.manage', 'parcels.view', 'parcels.create']],
            ['route' => 'admin.cod-management.index', 'permissions' => ['cod.manage', 'cod.view']],
            ['route' => 'admin.vehicles.index', 'permissions' => ['vehicles.manage', 'vehicles.view', 'vehicles.create']],
            ['route' => 'admin.pricing.index', 'permissions' => ['pricing.manage', 'pricing.view']],
            ['route' => 'admin.settings', 'permissions' => ['settings.manage', 'settings.view', 'settings.profile', 'settings.password']],
        ];
    }

    /**
     * Resolve the first accessible admin route for the given user.
     */
    public static function firstAccessibleRouteFor(User $user): ?string
    {
        foreach (self::routes() as $route) {
            foreach ($route['permissions'] as $permission) {
                if ($user->can($permission)) {
                    return route($route['route']);
                }
            }
        }

        return null;
    }
}
