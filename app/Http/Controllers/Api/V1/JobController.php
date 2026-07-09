<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Role;
use App\Enums\ShipmentStatus;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Job\CollectPaymentRequest;
use App\Http\Requests\Api\Job\CreateCancelledRequest;
use App\Http\Requests\Api\Job\ScanParcelRequest;
use App\Http\Requests\Api\Job\UpdateBarcodeRequest;
use App\Http\Requests\Api\Job\UpdateStatusRequest;
use App\Http\Resources\JobResource;
use App\Models\Shipment;
use App\Services\ShipmentService;
use App\Services\ShipmentTrackingService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class JobController extends Controller
{
    public function __construct(
        private ShipmentService $shipmentService,
        private ShipmentTrackingService $trackingService,
        private readonly WalletService $walletService,
    ) {}

    /**
     * Get a list of jobs (shipments) for the authenticated rider.
     *
     * Query params:
     * - filter: 'assigned', 'completed', 'all' (default: 'assigned')
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $filter = $request->query('filter', 'assigned');
        $perPage = (int) $request->get('per_page', 10);
        $page = (int) $request->get('page', 1);
        if ($perPage < 1) {
            $perPage = 10;
        }
        if ($page < 1) {
            $page = 1;
        }
        // $bookingType = $request->query('booking_type', 'shipment');

        // Route to appropriate job source by role
        if ($user->hasRole(Role::RIDER->value)) {
            $jobs = $this->shipmentService->getRiderJobsPaginated($user->id, $filter, $perPage, $page);
        } elseif ($user->hasRole(Role::DROP_POINT_KEEPER->value)) {
            // Only show jobs that this keeper has scanned
            $jobs = $this->shipmentService->getDropPointKeeperJobsPaginated($filter, $user->id, $perPage, $page);
        } elseif ($user->hasRole(Role::CAR_DRIVER->value)) {
            // Only show jobs that this driver has scanned
            $jobs = $this->shipmentService->getCarDriverJobsPaginated($filter, $user->id, $perPage, $page);
        } elseif ($user->hasRole(Role::WAREHOUSE_KEEPER->value)) {
            // Only show jobs that this keeper has scanned
            $jobs = $this->shipmentService->getWarehouseKeeperJobsPaginated($filter, $user->id, $perPage, $page);
        } else {
            $jobs = new LengthAwarePaginator([], 0, $perPage, $page);
        }

        // $jobs = $jobs->where('booking_type', $bookingType);

        return ApiResponse::success([
            'jobs' => JobResource::collection($jobs->items()),
            'meta' => [
                'current_page' => $jobs->currentPage(),
                'last_page' => $jobs->lastPage(),
                'per_page' => $jobs->perPage(),
                'total' => $jobs->total(),
                'filter' => $filter,
            ],
        ]);
    }

    /**
     * Get all valid shipment statuses filtered by role.
     * Returns only the statuses that the authenticated user's role can see.
     */
    public function getValidStatuses(Request $request): JsonResponse
    {
        $user = $request->user();

        // Define role-specific visible statuses
        // Riders should only see: In Progress (Pickup/In Transit), Pending Handover, Deposited, Completed (Delivered)
        $riderVisibleStatuses = [
            ShipmentStatus::PICKUP->value,
            ShipmentStatus::IN_TRANSIT->value,
            ShipmentStatus::DELIVERED->value,
            ShipmentStatus::RETURNED->value,
            // Note: "Pending Handover" and "Deposited" are computed statuses from payment transactions
            // They are not part of ShipmentStatus enum, but displayed via JobResource
        ];

        // Get all statuses or filter by role
        if ($user && $user->hasRole(Role::RIDER->value)) {
            // For riders, only return the basic statuses they can set
            $allowedStatuses = array_filter(
                ShipmentStatus::cases(),
                fn (ShipmentStatus $status) => in_array($status->value, $riderVisibleStatuses, true)
            );

            $statuses = array_map(
                fn (ShipmentStatus $status) => [
                    'value' => $status->value,
                    'label' => $this->getRiderFriendlyLabel($status),
                    'slug' => $status->slug(),
                ],
                $allowedStatuses
            );
        } else {
            // For other roles (admin, keeper, driver), return all statuses
            $statuses = array_map(
                fn (ShipmentStatus $status) => [
                    'value' => $status->value,
                    'label' => $status->label(),
                    'slug' => $status->slug(),
                ],
                ShipmentStatus::cases()
            );
        }

        return ApiResponse::success([
            'statuses' => array_values($statuses),
        ]);
    }

    /**
     * create a cancelled shipment with reason and comment
     */
    public function cancelledShipment(CreateCancelledRequest $request): JsonResponse
    {
        $user = $request->user();

        try {
            if ($user && ($user->hasRole(Role::RIDER->value) || $user->hasRole(Role::CAR_DRIVER->value) || $user->hasRole(Role::DROP_POINT_KEEPER->value))) {
                $data = $request->validated();
                $data['cancelled_by'] = ($user->hasRole(Role::RIDER->value) || $user->hasRole(Role::CAR_DRIVER->value)) ? 'driver' : 'drop_point_keeper';
                $data['cancelled_by_user_id'] = $user->id;
                $job = $this->shipmentService->cancelShipment($data);
            } else {
                return ApiResponse::forbidden(__('youDoNotHavePermissionToCancelShipments'));
            }

            return ApiResponse::success(
                ['job' => new JobResource($job)],
                __('shipmentCancelledSuccessfully')
            );
        } catch (\Exception $e) {
            return ApiResponse::badRequest($e->getMessage());
        }
    }

    /**
     * Get rider-friendly labels for statuses.
     */
    private function getRiderFriendlyLabel(ShipmentStatus $status): string
    {
        return match ($status) {
            ShipmentStatus::PICKUP => __('statusInProgress'),
            ShipmentStatus::IN_TRANSIT => __('statusInProgress'),
            ShipmentStatus::DELIVERED => __('statusCompleted'),
            ShipmentStatus::RETURNED => __('statusReturned'),
            default => $status->label(),
        };
    }

    /**
     * Get details of a specific job.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if ($user->hasRole(Role::RIDER->value)) {
            $job = $this->shipmentService->findJobForRider($id, $user->id);
        } elseif ($user->hasRole(Role::DROP_POINT_KEEPER->value)) {
            $job = $this->shipmentService->findJobForDropPointKeeper($id);
        } elseif ($user->hasRole(Role::CAR_DRIVER->value)) {
            $job = $this->shipmentService->findJobForCarDriver($id);
        } elseif ($user->hasRole(Role::WAREHOUSE_KEEPER->value)) {
            $job = $this->shipmentService->findJobForWarehouseKeeper($id);
        } else {
            $job = null;
        }

        if (! $job) {
            return ApiResponse::notFound(__('jobNotFoundOrNotAssignedToYou'));
        }

        $timeline = $this->trackingService->getAuditTrail($job);
        $timelineCancel = $this->trackingService->getAuditTrail($job);

        return ApiResponse::success([
            'job' => new JobResource($job),
            'timeline' => $timeline,
            'timeline_cancel' => $timelineCancel,
        ]);
    }

    /**
     * Update job status (e.g., picked_up, in_transit, delivered).
     */
    public function updateStatus(UpdateStatusRequest $request, int $id): JsonResponse
    {
        $status = null;
        DB::beginTransaction();
        try {
            $user = $request->user();
            if (! $user) {
                return ApiResponse::unauthorized();
            }

            $data = $request->validated();

            $job = $this->shipmentService->updateJobStatus($id, $user->id, $data);

            $timeline = $this->trackingService->getAuditTrail($job);

            // Compute nearest next-actor hints for indirect flow
            $extra = [];
            $status = $data['status'] ?? null;
            if ($job && $job->delivery_speed === 'indirect' && $status) {
                $lat = $user->latitude ?? $data['latitude'] ?? $job->handover_latitude ?? null;
                $lon = $user->longitude ?? $data['longitude'] ?? $job->handover_longitude ?? null;

                if ($lat !== null && $lon !== null) {
                    if (
                        $user->hasRole(Role::DROP_POINT_KEEPER->value)
                        && $status === \App\Enums\ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value
                    ) {
                        // Find nearest drop point keeper (warehouse side)
                        $nearestKeeper = \App\Models\User::query()
                            ->whereHas('roles', function ($q) {
                                $q->whereRaw("LOWER(REPLACE(name, '-', ' ')) LIKE ?", ['%drop%point%keeper%']);
                            })
                            ->whereNotNull('latitude')
                            ->whereNotNull('longitude')
                            ->selectRaw(
                                'users.*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) as distance_km',
                                [$lat, $lon, $lat]
                            )
                            ->orderBy('distance_km', 'asc')
                            ->first();
                        if ($nearestKeeper) {
                            $extra['nearest_drop_point_keeper'] = [
                                'id' => $nearestKeeper->id,
                                'name' => $nearestKeeper->name,
                                'address' => $nearestKeeper->address,
                                'latitude' => $nearestKeeper->latitude,
                                'longitude' => $nearestKeeper->longitude,
                                'distance_km' => isset($nearestKeeper->distance_km) ? round((float) $nearestKeeper->distance_km, 3) : null,
                            ];
                        }
                    }

                    if (
                        $user->hasRole(Role::CAR_DRIVER->value)
                        && in_array($status, [
                            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
                            \App\Enums\ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
                        ], true)
                    ) {
                        // Find nearest drop point keeper (for next leg)
                        $nearestKeeper = \App\Models\User::query()
                            ->whereHas('roles', function ($q) {
                                $q->whereRaw("LOWER(REPLACE(name, '-', ' ')) LIKE ?", ['%drop%point%keeper%']);
                            })
                            ->whereNotNull('latitude')
                            ->whereNotNull('longitude')
                            ->selectRaw(
                                'users.*, (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude)))) as distance_km',
                                [$lat, $lon, $lat]
                            )
                            ->orderBy('distance_km', 'asc')
                            ->first();
                        if ($nearestKeeper) {
                            $extra['nearest_drop_point_keeper'] = [
                                'id' => $nearestKeeper->id,
                                'name' => $nearestKeeper->name,
                                'address' => $nearestKeeper->address,
                                'latitude' => $nearestKeeper->latitude,
                                'longitude' => $nearestKeeper->longitude,
                                'distance_km' => isset($nearestKeeper->distance_km) ? round((float) $nearestKeeper->distance_km, 3) : null,
                            ];
                        }
                    }
                }
            }

            if ($job->booking_type === 'return' && $status !== null && $status === \App\Enums\ShipmentStatus::DELIVERED->value) {
                // $shipment = Shipment::where('shipment_id', $id)->first();
                // $this->walletService->pendingHold(userId: $shipment->user_id);
                $job->sender_receive_payment_status = 'pending';
                $job->save();
            }

            DB::commit();

            return ApiResponse::success(
                [
                    'job' => new JobResource($job),
                    'timeline' => $timeline,
                    'extra' => $extra,
                ],
                __('jobStatusUpdatedSuccessfully')
            );
        } catch (\Throwable $e) {
            Log::info('Error updating job status', [
                'error' => $e->getMessage(),
                'stack' => $e->getTraceAsString(),
            ]);
            DB::rollback();

            return ApiResponse::badRequest($e->getMessage());
        }
    }

    /**
     * Collect cash on delivery payment.
     */
    public function collectPayment(CollectPaymentRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        try {
            $collectedFrom = $data['collected_from'] ?? 'receiver';
            $job = $this->shipmentService->collectPayment($data['shipment_id'], $user->id, $collectedFrom);

            return ApiResponse::success(
                new JobResource($job),
                __('paymentCollectedSuccessfully')
            );
        } catch (\Exception $e) {
            return ApiResponse::badRequest($e->getMessage());
        }
    }

    /**
     * Scan and accept a parcel (create job from scan).
     */
    public function scanParcel(ScanParcelRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        try {
            $job = $this->shipmentService->scanParcel($data['shipment_id'], $user->id);

            $responseData = [
                'job' => new JobResource($job),
            ];

            // Include suggested next status if available
            if (isset($job->suggested_next_status)) {
                $responseData['suggested_next_status'] = $job->suggested_next_status;
                $responseData['message_hint'] = __('scanSuccessfulPleaseUpdateStatusTo', [
                    'status' => $job->suggested_next_status,
                ]);
            }

            return ApiResponse::created(
                $responseData,
                __('parcelScannedAndAssignedSuccessfully')
            );
        } catch (\Exception $e) {
            return ApiResponse::badRequest($e->getMessage());
        }
    }

    /**
     * Get the complete timeline (assignments + status history) for a job.
     */
    public function getTimeline(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if ($user->hasRole(Role::RIDER->value)) {
            $job = $this->shipmentService->findJobForRider($id, $user->id);
        } elseif ($user->hasRole(Role::DROP_POINT_KEEPER->value)) {
            $job = $this->shipmentService->findJobForDropPointKeeper($id);
        } elseif ($user->hasRole(Role::CAR_DRIVER->value)) {
            $job = $this->shipmentService->findJobForCarDriver($id);
        } elseif ($user->hasRole(Role::WAREHOUSE_KEEPER->value)) {
            $job = $this->shipmentService->findJobForWarehouseKeeper($id);
        } else {
            $job = null;
        }

        if (! $job) {
            return ApiResponse::notFound(__('jobNotFoundOrNotAssignedToYou'));
        }

        $timeline = $this->trackingService->getAuditTrail($job);
        $stageWiseSummary = $this->trackingService->getStageWiseSummary($job);

        return ApiResponse::success([
            'timeline' => $timeline,
            'stage_wise_summary' => $stageWiseSummary,
        ]);
    }

    /**
     * Get current active users working on a job.
     */
    public function getActiveUsers(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $job = $this->shipmentService->findJobForRider($id, $user->id);

        if (! $job) {
            return ApiResponse::notFound(__('jobNotFoundOrNotAssignedToYou'));
        }

        $activeUsers = $this->trackingService->getCurrentActiveUsers($job);

        return ApiResponse::success([
            'active_users' => $activeUsers->map(function ($assignment) {
                return [
                    'user_id' => $assignment->user_id,
                    'user_name' => $assignment->user->name ?? __('statusUnknown'),
                    'role' => $assignment->role,
                    'stage' => $assignment->stage,
                    'started_at' => $assignment->started_at,
                ];
            }),
        ]);
    }

    /**
     * Update barcode information for a shipment.
     */
    public function updateBarcode(UpdateBarcodeRequest $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return ApiResponse::unauthorized();
        }

        $data = $request->validated();

        try {
            $job = $this->shipmentService->updateBarcode($id, $user->id, $data['barcode_number']);

            if (! $job) {
                return ApiResponse::notFound(__('jobNotFound'));
            }

            return ApiResponse::success(
                ['job' => new JobResource($job)],
                __('barcodeUpdatedSuccessfully')
            );
        } catch (\Exception $e) {
            return ApiResponse::badRequest($e->getMessage());
        }
    }
}
