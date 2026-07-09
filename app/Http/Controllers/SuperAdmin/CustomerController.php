<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\SortHelper;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    /**
     * Display a listing of customers.
     */
    public function index(Request $request): Response
    {
        $user = auth()->user();

        if (!$user || (!$user->can('customers.view') && !$user->can('customers.manage'))) {
            abort(401);
        }

        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sortBy = trim((string) $request->query('sort_by', 'id'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');
        $sortColumn = SortHelper::column($sortBy, [
            'id' => 'id',
            'name' => 'name',
            'email' => 'email',
            'phone' => 'phone_number',
            'phone_number' => 'phone_number',
            'status' => 'status',
            'city' => 'city',
            'member_since' => 'member_since',
            'created_at' => 'created_at',
            'shipments' => 'shipments_count',
            'shipments_count' => 'shipments_count',
        ], 'id');

        $customers = User::query()
            ->whereHas('roles', fn ($query) => $query->where('name', Role::CUSTOMER->value))
            ->withCount('shipments')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($searchQuery) use ($search) {
                    $like = "%{$search}%";

                    $searchQuery
                        ->where('id', 'like', $like)
                        ->orWhere('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('phone_number', 'like', $like)
                        ->orWhere('status', 'like', $like)
                        ->orWhere('address', 'like', $like)
                        ->orWhere('city', 'like', $like)
                        ->orWhere('country', 'like', $like)
                        ->orWhere('business_type', 'like', $like)
                        ->orWhere('trade_license_number', 'like', $like);
                });
            })
            ->when($status !== '' && strtolower($status) !== 'all', function ($query) use ($status) {
                $query->whereRaw('LOWER(TRIM(status)) = ?', [strtolower($status)]);
            })
            ->orderBy($sortColumn, $sortDir)
            ->when($sortColumn !== 'id', fn ($query) => $query->orderBy('id', 'desc'))
            ->get()
            ->map(static function (User $customer) {
                return [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone_number' => $customer->phone_number,
                    'status' => $customer->status,
                    'city' => $customer->address,
                    'member_since' => optional($customer->member_since)->toIso8601String()
                        ?? optional($customer->created_at)->toIso8601String(),
                    'created_at' => optional($customer->created_at)->toIso8601String(),
                    'shipments_count' => $customer->shipments_count ?? 0,
                    'avatar_url' => media_url($customer->avatar_path),
                ];
            });

        return Inertia::render('SuperAdmin/Customers/Index', [
            'customers' => $customers,
            'filters' => [
                'search' => $search,
                'status' => $status,
                'sort_by' => $sortBy,
                'sort_dir' => $sortDir,
            ],
        ]);
    }
}
