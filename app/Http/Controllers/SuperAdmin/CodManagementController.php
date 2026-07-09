<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Contracts\ShipmentServiceInterface;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\CodManagementService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CodManagementController extends Controller
{
    public function __construct(
        private readonly CodManagementService $codManagementService,
        private readonly WalletService $walletService,
        private readonly ShipmentServiceInterface $shipmentService,
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();

        if (! $user || (! $user->can('cod.view'))) {
            abort(401);
        }

        $search = $request->input('search') ?? '';
        $filters = $request->only(['rider', 'status']);
        $filters['sort_by'] = trim((string) $request->query('sort_by', 'created_at'));
        $filters['sort_dir'] = trim((string) $request->query('sort_dir', 'desc'));

        $shipments = $this->codManagementService->paginateShipments($search, $filters);
        $stats = $this->codManagementService->getStatistics();

        // Get rider names filtered by zone if applicable
        $riderQuery = User::role([Role::RIDER->value, Role::CAR_DRIVER->value])
            ->whereNotNull('name');

        // Filter by zone for non-superadmin employees
        if ($user && ! $user->hasRole('superadmin') && $user->zone_id && $user->platform === 'Admin Portal') {
            $riderQuery->where('zone_id', $user->zone_id);
        }

        $riderNames = $riderQuery->pluck('name')
            ->unique()
            ->sort()
            ->values()
            ->all();

        return Inertia::render('SuperAdmin/CodManagement/Index', [
            'shipments' => $shipments,
            'stats' => $stats,
            'riders' => $riderNames,
            'filters' => [
                'search' => $search,
                'rider' => $filters['rider'] ?? 'all',
                'status' => $filters['status'] ?? 'all',
                'sort_by' => $filters['sort_by'],
                'sort_dir' => $filters['sort_dir'],
            ],
        ]);
    }

    public function show(Request $request, int $id): Response|JsonResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('cod.view'))) {
            abort(401);
        }

        $shipment = $this->codManagementService->getShipmentDetails($id);

        if ($request->expectsJson()) {
            return response()->json([
                'props' => [
                    'shipment' => $shipment,
                ],
            ]);
        }

        return Inertia::render('SuperAdmin/CodManagement/Show', [
            'shipment' => $shipment,
        ]);
    }

    public function markAsCollected(Request $request, int $id): RedirectResponse|JsonResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('cod.collect'))) {
            abort(401);
        }

        $this->codManagementService->markAsCollected($id);

        $shipment = $this->shipmentService->find($id);

        $this->walletService->creditHold(
            $shipment->user_id,
            $shipment->parcel_amount,
            'COD Payment Hold - '.$shipment->order_number,
            [
                'shipment_id' => $shipment->id,
                'shipment_order_number' => $shipment->order_number,
                'type' => 'cod_hold',
                'reason' => 'COD Payment Hold',
            ]
        );
        $shipment->sender_receive_payment_status = 'held';
        $shipment->save();

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => __('codShipmentMarkedAsCollectedSuccessfully'),
            ]);
        }

        return redirect()
            ->back()
            ->with('success', __('codShipmentMarkedAsCollectedSuccessfully'));
    }
}
