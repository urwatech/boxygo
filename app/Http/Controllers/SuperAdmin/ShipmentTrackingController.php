<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use App\Services\ShipmentTrackingService;
use App\Support\SortHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ShipmentTrackingController extends Controller
{
    public function __construct(private ShipmentTrackingService $trackingService) {}

    /**
     * Get the complete timeline for a shipment (for admin view).
     */
    public function getTimeline(Shipment $shipment): JsonResponse
    {
        $user = auth()->user();

        if (! $user || (! $user->can('shipments.view') && ! $user->can('shipments.manage'))) {
            abort(401);
        }

        $timeline = $this->trackingService->getAuditTrail($shipment);
        $stageWiseSummary = $this->trackingService->getStageWiseSummary($shipment);
        $activeUsers = $this->trackingService->getCurrentActiveUsers($shipment);

        return response()->json([
            'success' => true,
            'data' => [
                'shipment_id' => $shipment->id,
                'current_status' => $shipment->status,
                'timeline' => $timeline,
                'stage_wise_summary' => $stageWiseSummary,
                'active_users' => $activeUsers->map(function ($assignment) {
                    return [
                        'user_id' => $assignment->user_id,
                        'user_name' => $assignment->user->name ?? 'Unknown',
                        'employee_id' => $assignment->user->employee_id ?? null,
                        'role' => $assignment->role,
                        'stage' => $assignment->stage,
                        'started_at' => $assignment->started_at,
                    ];
                }),
            ],
        ]);
    }

    /**
     * Show the shipment tracking page (Inertia view).
     */
    public function show(Shipment $shipment): Response
    {
        $user = auth()->user();

        if (! $user || (! $user->can('shipments.view') && ! $user->can('shipments.manage'))) {
            abort(401);
        }

        $timeline = $this->trackingService->getAuditTrail($shipment);
        $stageWiseSummary = $this->trackingService->getStageWiseSummary($shipment);
        $activeUsers = $this->trackingService->getCurrentActiveUsers($shipment);

        // Load shipment with all relationships
        $shipment->load(['user', 'rider', 'shelf', 'size', 'directStatus', 'indirectStatus']);

        return Inertia::render('SuperAdmin/ShipmentTracking', [
            'shipment' => [
                'id' => $shipment->id,
                'ship_id' => 'MP'.str_pad($shipment->id, 7, '0', STR_PAD_LEFT),
                'status' => $shipment->status,
                'delivery_speed' => $shipment->delivery_speed,
                'sender_name' => $shipment->sender_name,
                'receiver_name' => $shipment->receiver_name,
                'handover_address' => $shipment->handover_address,
                'delivery_address' => $shipment->delivery_address,
                'customer' => $shipment->user ? [
                    'id' => $shipment->user->id,
                    'name' => $shipment->user->name,
                ] : null,
                'rider' => $shipment->rider ? [
                    'id' => $shipment->rider->id,
                    'name' => $shipment->rider->name,
                    'employee_id' => $shipment->rider->employee_id,
                ] : null,
            ],
            'timeline' => $timeline,
            'stage_wise_summary' => $stageWiseSummary,
            'active_users' => $activeUsers->map(function ($assignment) {
                return [
                    'user_id' => $assignment->user_id,
                    'user_name' => $assignment->user->name ?? 'Unknown',
                    'employee_id' => $assignment->user->employee_id ?? null,
                    'role' => $assignment->role,
                    'stage' => $assignment->stage,
                    'started_at' => $assignment->started_at,
                ];
            }),
        ]);
    }

    /**
     * Get all assignments for a shipment.
     */
    public function getAssignments(Request $request, Shipment $shipment): JsonResponse
    {
        $user = auth()->user();

        if (! $user || (! $user->can('shipments.view') && ! $user->can('shipments.manage'))) {
            abort(401);
        }

        $search = trim((string) $request->query('search', ''));
        $status = strtolower(trim((string) $request->query('status', '')));
        $sortBy = trim((string) $request->query('sort_by', 'assigned_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'asc');

        $assignments = $shipment->assignments()
            ->with(['user', 'assignedBy'])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($searchQuery) use ($search) {
                    $like = "%{$search}%";

                    $searchQuery
                        ->where('role', 'like', $like)
                        ->orWhere('stage', 'like', $like)
                        ->orWhere('notes', 'like', $like)
                        ->orWhereHas('user', function ($userQuery) use ($like) {
                            $userQuery->where('name', 'like', $like)
                                ->orWhere('employee_id', 'like', $like);
                        })
                        ->orWhereHas('assignedBy', function ($assignedByQuery) use ($like) {
                            $assignedByQuery->where('name', 'like', $like)
                                ->orWhere('employee_id', 'like', $like);
                        });
                });
            })
            ->when($status !== '' && $status !== 'all', function ($query) use ($status) {
                match ($status) {
                    'completed' => $query->whereNotNull('completed_at'),
                    'active' => $query->whereNotNull('started_at')->whereNull('completed_at'),
                    'pending' => $query->whereNull('started_at')->whereNull('completed_at'),
                    default => null,
                };
            })
            ->when(SortHelper::key($sortBy) === 'user', function ($query) use ($sortDir) {
                $query->orderByRaw("COALESCE((SELECT name FROM users WHERE users.id = shipment_assignments.user_id LIMIT 1), '') {$sortDir}");
            }, function ($query) use ($sortBy, $sortDir) {
                $query->orderBy(SortHelper::column($sortBy, [
                    'id' => 'shipment_assignments.id',
                    'role' => 'shipment_assignments.role',
                    'stage' => 'shipment_assignments.stage',
                    'assigned_at' => 'shipment_assignments.assigned_at',
                    'started_at' => 'shipment_assignments.started_at',
                    'completed_at' => 'shipment_assignments.completed_at',
                    'created_at' => 'shipment_assignments.created_at',
                    'updated_at' => 'shipment_assignments.updated_at',
                ], 'shipment_assignments.assigned_at'), $sortDir);
            })
            ->orderBy('shipment_assignments.id', 'asc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'assignments' => $assignments->map(function ($assignment) {
                    return [
                        'id' => $assignment->id,
                        'user' => [
                            'id' => $assignment->user->id,
                            'name' => $assignment->user->name,
                            'employee_id' => $assignment->user->employee_id ?? null,
                        ],
                        'assigned_by' => $assignment->assignedBy ? [
                            'id' => $assignment->assignedBy->id,
                            'name' => $assignment->assignedBy->name,
                        ] : null,
                        'role' => $assignment->role,
                        'stage' => $assignment->stage,
                        'assigned_at' => $assignment->assigned_at,
                        'started_at' => $assignment->started_at,
                        'completed_at' => $assignment->completed_at,
                        'duration_minutes' => $assignment->getDurationMinutes(),
                        'status' => $assignment->isCompleted() ? 'completed' :
                                   ($assignment->isActive() ? 'active' : 'pending'),
                        'notes' => $assignment->notes,
                    ];
                }),
            ],
        ]);
    }

    /**
     * Get status history for a shipment.
     */
    public function getStatusHistory(Request $request, Shipment $shipment): JsonResponse
    {
        $user = auth()->user();

        if (! $user || (! $user->can('shipments.view') && ! $user->can('shipments.manage'))) {
            abort(401);
        }

        $search = trim((string) $request->query('search', ''));
        $status = trim((string) $request->query('status', ''));
        $sortBy = trim((string) $request->query('sort_by', 'created_at'));
        $sortDir = SortHelper::direction($request->query('sort_dir'), 'desc');

        $history = $shipment->statusHistory()
            ->with('user')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($searchQuery) use ($search) {
                    $like = "%{$search}%";

                    $searchQuery
                        ->where('from_status', 'like', $like)
                        ->orWhere('to_status', 'like', $like)
                        ->orWhere('location_name', 'like', $like)
                        ->orWhere('notes', 'like', $like)
                        ->orWhereHas('user', function ($userQuery) use ($like) {
                            $userQuery->where('name', 'like', $like)
                                ->orWhere('employee_id', 'like', $like);
                        });
                });
            })
            ->when($status !== '' && strtolower($status) !== 'all', function ($query) use ($status) {
                $query->whereRaw('LOWER(TRIM(to_status)) = ?', [strtolower($status)]);
            })
            ->orderBy(SortHelper::column($sortBy, [
                'id' => 'shipment_status_history.id',
                'from_status' => 'shipment_status_history.from_status',
                'to_status' => 'shipment_status_history.to_status',
                'status' => 'shipment_status_history.to_status',
                'progress_index' => 'shipment_status_history.progress_index',
                'location_name' => 'shipment_status_history.location_name',
                'created_at' => 'shipment_status_history.created_at',
                'updated_at' => 'shipment_status_history.updated_at',
            ], 'shipment_status_history.created_at'), $sortDir)
            ->orderBy('shipment_status_history.id', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'status_history' => $history->map(function ($entry) {
                    return [
                        'id' => $entry->id,
                        'user' => $entry->user ? [
                            'id' => $entry->user->id,
                            'name' => $entry->user->name,
                            'employee_id' => $entry->user->employee_id ?? null,
                        ] : null,
                        'from_status' => $entry->from_status,
                        'to_status' => $entry->to_status,
                        'progress_index' => $entry->progress_index,
                        'location' => $entry->hasLocation() ? $entry->getLocationCoordinates() : null,
                        'location_name' => $entry->location_name,
                        'notes' => $entry->notes,
                        'metadata' => $entry->metadata,
                        'created_at' => $entry->created_at,
                        'change_description' => $entry->getChangeDescription(),
                    ];
                }),
            ],
        ]);
    }
}
