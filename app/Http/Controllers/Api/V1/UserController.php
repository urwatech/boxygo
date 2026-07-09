<?php

namespace App\Http\Controllers\Api\V1;

use App\Contracts\ShipmentRepositoryInterface;
use App\Enums\Role;
use App\Enums\ShipmentStatus;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\User\DepositCashRequest;
use App\Http\Requests\Api\User\UpdateDocumentsRequest;
use App\Http\Requests\Api\User\UpdateProfilePictureRequest;
use App\Http\Requests\Api\User\UpdateProfileRequest;
use App\Http\Resources\JobResource;
use App\Http\Resources\UserResource;
use App\Models\PaymentTransaction;
use App\Models\Shipment;
use App\Models\User;
use App\Services\UserService;
use App\Services\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    public function __construct(private UserService $userService, private readonly WalletService $walletService, private readonly ShipmentRepositoryInterface $repository) {}

    public function me(Request $request): JsonResponse
    {
        return ApiResponse::success(
            new UserResource($request->user()),
            __('authenticatedUserFetchedSuccessfully')
        );
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        // Handle avatar upload
        if ($request->hasFile('avatar')) {
            if ($user->avatar_path) {
                delete_media_file($user->avatar_path);
            }

            $data['avatar_path'] = store_public_upload($request->file('avatar'), 'user-uploads', 'avatars');
            unset($data['avatar']);
        }

        // Map mobile keys to database columns
        if (isset($data['blood_group'])) {
            $data['blood_type'] = $data['blood_group'];
            unset($data['blood_group']);
        }
        if (isset($data['emergency_contact'])) {
            $data['emergency_phone_number'] = $data['emergency_contact'];
            unset($data['emergency_contact']);
        }

        // Update user profile
        $user->update($data);

        return ApiResponse::success(
            new UserResource($user->fresh()),
            __('profileUpdatedSuccessfully')
        );
    }

    public function vehicles(): JsonResponse
    {
        $users = $this->userService->usersWithVehicles();

        return ApiResponse::success(
            UserResource::collection($users),
            __('usersWithAssignedVehiclesFetchedSuccessfully')
        );
    }

    public function updateWalletTest(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric',
            'status' => 'required|in:completed,held',
            'description' => 'required|string',
            'user_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'ok' => false,
                'errors' => $validator->errors(),
            ], JsonResponse::HTTP_UNPROCESSABLE_ENTITY);
        }

        $data = $validator->validated();

        $wallet = $this->walletService->credit(
            $request->user_id,
            max((float) $data['amount'], 0.01), // ensure positive amount
            $request->description
        );

        return ApiResponse::success(
            $wallet,
            __('amountAddedToWalletSuccessfully')
        );
    }

    public function getDocuments(Request $request): JsonResponse
    {
        $user = $request->user();

        $documents = [
            'driving_license' => [
                'uploaded' => ! empty($user->driving_license),
                'url' => media_url($user->driving_license),
                'filename' => $user->driving_license ? basename($user->driving_license) : null,
            ],
            'id_card_front' => [
                'uploaded' => ! empty($user->id_card_front),
                'url' => media_url($user->id_card_front),
                'filename' => $user->id_card_front ? basename($user->id_card_front) : null,
            ],
            'id_card_back' => [
                'uploaded' => ! empty($user->id_card_back),
                'url' => media_url($user->id_card_back),
                'filename' => $user->id_card_back ? basename($user->id_card_back) : null,
            ],
            'passport' => [
                'uploaded' => ! empty($user->passport),
                'url' => media_url($user->passport),
                'filename' => $user->passport ? basename($user->passport) : null,
            ],
            'idp' => [
                'uploaded' => ! empty($user->idp),
                'url' => media_url($user->idp),
                'filename' => $user->idp ? basename($user->idp) : null,
            ],
            'blood_group' => $user->blood_type,
            'emergency_contact' => $user->emergency_phone_number,
        ];

        return ApiResponse::success(
            $documents,
            __('documentsFetchedSuccessfully')
        );
    }

    public function updateDocuments(UpdateDocumentsRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $documentFields = ['driving_license', 'id_card_front', 'id_card_back', 'passport', 'idp'];

        foreach ($documentFields as $field) {
            if ($request->hasFile($field)) {
                if ($user->$field) {
                    delete_media_file($user->$field);
                }

                $data[$field] = store_public_upload($request->file($field), 'user-uploads', 'documents');
            }
        }

        // Map mobile keys to database columns
        if (isset($data['blood_group'])) {
            $data['blood_type'] = $data['blood_group'];
            unset($data['blood_group']);
        }
        if (isset($data['emergency_contact'])) {
            $data['emergency_phone_number'] = $data['emergency_contact'];
            unset($data['emergency_contact']);
        }

        // Update user documents
        $user->update($data);

        return ApiResponse::success(
            new UserResource($user->fresh()),
            __('documentsUpdatedSuccessfully')
        );
    }

    public function updateProfilePicture(UpdateProfilePictureRequest $request): JsonResponse
    {
        try {
            $user = $request->user();

            $oldAvatar = $user->avatar_path;

            // Store new image
            $avatarPath = store_public_upload(
                $request->file('profile_picture'),
                'user-uploads',
                'avatars'
            );

            // Update DB
            $user->update([
                'avatar_path' => $avatarPath,
            ]);

            if ($oldAvatar) {
                try {
                    delete_media_file($oldAvatar);
                } catch (\Exception $e) {
                    Log::warning('Failed to delete old profile picture', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            return ApiResponse::success(
                new UserResource($user->fresh()),
                __('profilePictureUpdatedSuccessfully')
            );

        } catch (\Exception $e) {
            Log::error('Profile picture update failed', [
                'user_id' => optional($request->user())->id,
                'error' => $e->getMessage(),
            ]);

            return ApiResponse::error(
                __('somethingWentWrongWhileUpdatingProfilePicture'),
                500
            );
        }
    }

    public function earnings(Request $request): JsonResponse
    {
        $user = $request->user();
        $completedStatuses = $this->getCompletionStatuses();

        // Determine user's role(s)
        $roleNames = array_map('strtolower', $user->getRoleNames()->toArray());
        $isRider = in_array(strtolower(Role::RIDER->value), $roleNames, true);
        $isCarDriver = in_array(strtolower(Role::CAR_DRIVER->value), $roleNames, true);
        $isDropPointKeeper = in_array(strtolower(Role::DROP_POINT_KEEPER->value), $roleNames, true);

        // Base query for shipments that user has completed
        // For riders: check rider_id
        // For car drivers and drop point keepers: check assignments
        $completedShipmentsQuery = function () use ($user, $completedStatuses, $isRider, $isCarDriver, $isDropPointKeeper) {
            $query = Shipment::query()
                ->where(function ($q) use ($user, $isRider, $isCarDriver, $isDropPointKeeper) {
                    if ($isRider) {
                        $q->where('rider_id', $user->id);
                    }

                    // Also check assignments for car drivers and keepers
                    if ($isCarDriver) {
                        $q->orWhereHas('assignments', function ($assignmentQuery) use ($user) {
                            $assignmentQuery->where('user_id', $user->id)
                                ->where('role', Role::CAR_DRIVER->value)
                                ->whereNotNull('completed_at');
                        });
                    }

                    if ($isDropPointKeeper) {
                        $q->orWhereHas('assignments', function ($assignmentQuery) use ($user) {
                            $assignmentQuery->where('user_id', $user->id)
                                ->where('role', Role::DROP_POINT_KEEPER->value)
                                ->whereNotNull('completed_at');
                        });
                    }
                })
                ->where(function ($query) use ($completedStatuses) {
                    $query->whereHas('latestStatusHistory', function ($history) use ($completedStatuses) {
                        $history->whereIn('to_status', $completedStatuses);
                    })->orWhereIn('status', $completedStatuses);
                });

            return $query;
        };

        // Get today's deliveries count based on when completion status was recorded
        $todaysDeliveries = $completedShipmentsQuery()
            ->where(function ($query) use ($completedStatuses) {
                $query->whereHas('latestStatusHistory', function ($history) use ($completedStatuses) {
                    $history->whereIn('to_status', $completedStatuses)
                        ->whereDate('created_at', today());
                })->orWhere(function ($legacy) use ($completedStatuses) {
                    $legacy->whereIn('status', $completedStatuses)
                        ->whereDate('updated_at', today());
                });
            })
            ->count();

        // Get total amount from all delivered shipments (delivery fees)
        $totalAmount = (int) $completedShipmentsQuery()->sum('total_fee');

        // Get cash collected (COD) that this user has collected from customers
        // Check all transaction types based on role
        $cashCollectedQuery = PaymentTransaction::where('rider_id', $user->id)
            ->where('payment_method', 'cash')
            ->where('status', 'completed')
            ->whereNotNull('collected_at');

        if ($isRider) {
            $cashCollectedQuery->where('transaction_type', 'rider_collection');
        } elseif ($isCarDriver) {
            $cashCollectedQuery->where('transaction_type', 'car_driver_collection');
        } elseif ($isDropPointKeeper) {
            $cashCollectedQuery->where('transaction_type', 'drop_point_keeper_collection');
        } else {
            // If user has multiple roles, get all their collections
            $cashCollectedQuery->whereIn('transaction_type', [
                'rider_collection',
                'car_driver_collection',
                'drop_point_keeper_collection',
            ]);
        }

        $cashCollected = $cashCollectedQuery->sum('amount');

        // Get prepaid shipment amount (online payments)
        $prepaidShipment = (int) $completedShipmentsQuery()
            ->where('payment_method', 'online')
            ->where('payment_status', 'paid')
            ->sum('parcel_amount');

        // Get COD shipments that user has collected
        $codShipmentsQuery = $completedShipmentsQuery()->where('payment_method', 'cash');

        // Add collection filter based on user role
        $codShipmentsQuery->where(function ($q) use ($user, $isRider, $isCarDriver, $isDropPointKeeper) {
            $hasCondition = false;

            if ($isRider) {
                $q->whereHas('riderCollection', function ($query) use ($user) {
                    $query->where('rider_id', $user->id)
                        ->where('status', 'completed')
                        ->whereNotNull('collected_at');
                });
                $hasCondition = true;
            }

            if ($isCarDriver) {
                if ($hasCondition) {
                    $q->orWhereHas('carDriverCollection', function ($query) use ($user) {
                        $query->where('rider_id', $user->id)
                            ->where('status', 'completed')
                            ->whereNotNull('collected_at');
                    });
                } else {
                    $q->whereHas('carDriverCollection', function ($query) use ($user) {
                        $query->where('rider_id', $user->id)
                            ->where('status', 'completed')
                            ->whereNotNull('collected_at');
                    });
                    $hasCondition = true;
                }
            }

            if ($isDropPointKeeper) {
                if ($hasCondition) {
                    $q->orWhereHas('dropPointKeeperCollection', function ($query) use ($user) {
                        $query->where('rider_id', $user->id)
                            ->where('status', 'completed')
                            ->whereNotNull('collected_at');
                    });
                } else {
                    $q->whereHas('dropPointKeeperCollection', function ($query) use ($user) {
                        $query->where('rider_id', $user->id)
                            ->where('status', 'completed')
                            ->whereNotNull('collected_at');
                    });
                }
            }
        });

        $codShipments = $codShipmentsQuery
            ->with([
                'user',
                'rider',
                'review',
                'riderCollection',
                'carDriverCollection',
                'dropPointKeeperCollection',
                'adminSettlement.collectedBy',
                'latestStatusHistory',
                'statusHistory' => function ($query) {
                    $query->orderBy('created_at', 'asc');
                },
                'assignments.user',
            ])
            ->orderBy('created_at', 'desc')
            ->limit(20)
            ->get();

        // Calculate total miles from all delivered shipments
        $completedShipments = $completedShipmentsQuery()->get();
        $totalMiles = $this->calculateTotalMiles($completedShipments);

        return ApiResponse::success([
            'todays_deliveries' => $todaysDeliveries,
            'total_amount' => (int) $totalAmount,
            'cash_collected' => (int) $cashCollected,
            'prepaid_shipment' => (int) $prepaidShipment,
            'total_miles' => round((float) $totalMiles, 2),
            // 'cod_shipments' => JobResource::collection($codShipments),
        ]);
    }

    /**
     * Calculate total miles traveled for delivered shipments
     * For direct shipments: pickup to delivery distance
     * For indirect shipments: only the segments that the user actually traveled
     *
     * @param  \Illuminate\Support\Collection  $completedShipments
     */
    private function calculateTotalMiles($completedShipments): float
    {
        $user = request()->user();
        $totalMiles = 0;

        foreach ($completedShipments as $shipment) {
            // Check if this is a direct or indirect shipment
            if ($shipment->delivery_speed === 'direct') {
                // For direct delivery: simple pickup to delivery distance
                $distanceKm = $this->calculateDistanceInKm(
                    $shipment->handover_latitude,
                    $shipment->handover_longitude,
                    $shipment->delivery_latitude,
                    $shipment->delivery_longitude
                );
                $totalMiles += $distanceKm * 0.621371;
            } else {
                // For indirect delivery: calculate based on user's completed assignments
                $totalMiles += $this->calculateIndirectShipmentMiles($shipment, $user->id);
            }
        }

        return $totalMiles;
    }

    /**
     * Calculate miles for indirect shipment based on user's completed segments
     * Uses shipment_status_history table to get actual GPS coordinates
     *
     * @param  \App\Models\Shipment  $shipment
     */
    private function calculateIndirectShipmentMiles($shipment, int $userId): float
    {
        $totalMiles = 0;

        // Get all status history for this shipment by this user with coordinates
        $statusHistory = $shipment->statusHistory()
            ->where('user_id', $userId)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->orderBy('created_at', 'asc')
            ->get();

        if ($statusHistory->isEmpty()) {
            return 0;
        }

        // Define the segments based on status transitions
        $segments = $this->getSegmentsForUser($statusHistory);

        // Calculate distance for each segment
        foreach ($segments as $segment) {
            if (isset($segment['start']) && isset($segment['end'])) {
                $distanceKm = $this->calculateDistanceInKm(
                    $segment['start']['lat'],
                    $segment['start']['lon'],
                    $segment['end']['lat'],
                    $segment['end']['lon']
                );
                $totalMiles += $distanceKm * 0.621371;
            }
        }

        return $totalMiles;
    }

    /**
     * Get pickup and delivery segments from status history
     * Based on the actual status transitions in shipment_status_history table
     *
     * @param  \Illuminate\Support\Collection  $statusHistory
     */
    private function getSegmentsForUser($statusHistory): array
    {
        $segments = [];
        $pickupLocation = null;
        $deliveryLocation = null;

        foreach ($statusHistory as $history) {
            $fromStatus = $history->from_status;
            $toStatus = $history->to_status;

            // RIDER 1: Pickup from sender to Drop Point 1
            // Pickup location: from_status = "Assigned", to_status = "Pickup"
            if ($fromStatus === 'Assigned' && $toStatus === 'Pickup') {
                $pickupLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];
            }
            // Delivery location: from_status = "Arrived at Drop Point 1", to_status = "Delivered to Drop Point 1"
            if ($fromStatus === 'Arrived at Drop Point 1' && $toStatus === 'Delivered to Drop Point 1') {
                $deliveryLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];

                if ($pickupLocation) {
                    $segments[] = [
                        'start' => $pickupLocation,
                        'end' => $deliveryLocation,
                        'type' => 'rider_to_drop_point_1',
                    ];
                    $pickupLocation = null;
                    $deliveryLocation = null;
                }
            }

            // CAR DRIVER 1: Drop Point 1 to Warehouse
            // Pickup location: from_status = "Dispatched to Warehouse", to_status = "Pickup from Drop Point 1"
            if ($fromStatus === 'Dispatched to Warehouse' && $toStatus === 'Pickup from Drop Point 1') {
                $pickupLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];
            }
            // Delivery location: from_status = "In Transit to Warehouse", to_status = "Arrived at Warehouse"
            if ($fromStatus === 'In Transit to Warehouse' && $toStatus === 'Arrived at Warehouse') {
                $deliveryLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];

                if ($pickupLocation) {
                    $segments[] = [
                        'start' => $pickupLocation,
                        'end' => $deliveryLocation,
                        'type' => 'car_driver_to_warehouse',
                    ];
                    $pickupLocation = null;
                    $deliveryLocation = null;
                }
            }

            // CAR DRIVER 2: Warehouse to Drop Point 2
            // Pickup location: from_status = "Dispatched from Warehouse", to_status = "Pickup from Warehouse"
            if ($fromStatus === 'Dispatched from Warehouse' && $toStatus === 'Pickup from Warehouse') {
                $pickupLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];
            }
            // Delivery location (Warehouse 2 leg): from_status = "In Transit to Warehouse 2", to_status = "Arrived at Warehouse 2"
            if ($fromStatus === 'In Transit to Warehouse 2' && $toStatus === 'Arrived at Warehouse 2') {
                $deliveryLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];

                if ($pickupLocation) {
                    $segments[] = [
                        'start' => $pickupLocation,
                        'end' => $deliveryLocation,
                        'type' => 'car_driver_to_warehouse_2',
                    ];
                    $pickupLocation = null;
                    $deliveryLocation = null;
                }
            }
            // Pickup location (Warehouse 2 -> Drop Point 2 leg): from_status = "Dispatched from Warehouse 2", to_status = "Pickup from Warehouse 2"
            if ($fromStatus === 'Dispatched from Warehouse 2' && $toStatus === 'Pickup from Warehouse 2') {
                $pickupLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];
            }
            // Delivery location: from_status = "In Transit to Drop Point 2", to_status = "Arrived at Drop Point 2"
            if ($fromStatus === 'In Transit to Drop Point 2' && $toStatus === 'Arrived at Drop Point 2') {
                $deliveryLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];

                if ($pickupLocation) {
                    $segments[] = [
                        'start' => $pickupLocation,
                        'end' => $deliveryLocation,
                        'type' => 'car_driver_to_drop_point_2',
                    ];
                    $pickupLocation = null;
                    $deliveryLocation = null;
                }
            }

            // CAR DRIVER/RIDER 3: Drop Point 2 to Customer (Final Delivery)
            // Pickup location: from_status = "Dispatched from Drop Point 2", to_status = "Pickup from Drop Point 2"
            if ($fromStatus === 'Dispatched from Drop Point 2' && $toStatus === 'Pickup from Drop Point 2') {
                $pickupLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];
            }
            // Delivery location: from_status = "In Transit to Customer", to_status = "Delivered"
            if ($fromStatus === 'In Transit to Customer' && $toStatus === 'Delivered') {
                $deliveryLocation = [
                    'lat' => (float) $history->latitude,
                    'lon' => (float) $history->longitude,
                ];

                if ($pickupLocation) {
                    $segments[] = [
                        'start' => $pickupLocation,
                        'end' => $deliveryLocation,
                        'type' => 'final_delivery',
                    ];
                    $pickupLocation = null;
                    $deliveryLocation = null;
                }
            }
        }

        return $segments;
    }

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     * Returns distance in kilometers
     */
    private function calculateDistanceInKm(?float $lat1, ?float $lon1, ?float $lat2, ?float $lon2): float
    {
        if ($lat1 === null || $lon1 === null || $lat2 === null || $lon2 === null) {
            return 0;
        }

        $earthRadius = 6371; // Earth's radius in kilometers

        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon / 2) * sin($dLon / 2);

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }

    public function depositCash(DepositCashRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        try {
            // Helper for case-insensitive role checks
            $hasRole = function (User $user, string $role): bool {
                $names = array_map('strtolower', $user->getRoleNames()->toArray());

                return in_array(strtolower($role), $names, true);
            };

            // Get the shipment with relationships
            // For riders: check rider_id
            // For car drivers and drop point keepers: check payment transaction
            $shipment = \App\Models\Shipment::with(['riderCollection', 'adminSettlement'])
                ->where('id', $data['shipment_id'])
                ->where(function ($q) {
                    $q->where('payment_method', 'cash')->orWhere('receiver_payment_method', 'cash');
                })
                ->first();
            if (! $shipment) {
                return ApiResponse::notFound(__('commonShipmentNotFound'));
            }

            // Verify the user collected this payment
            $paymentTransaction = null;
            if ($hasRole($user, Role::RIDER->value)) {
                // For riders, check rider_id in shipment
                // if ($shipment->rider_id != $user->id) {
                //     return ApiResponse::notFound('Shipment not found or not assigned to you.');
                // }
                // Check payment transaction
                $paymentTransaction = \App\Models\PaymentTransaction::where('shipment_id', $shipment->id)
                    ->where('rider_id', $user->id)
                    ->where('transaction_type', 'rider_collection')
                    ->where('status', 'completed')
                    ->whereNull('rider_deposited_at')
                    ->orderBy('id', 'asc')
                    ->first();
            } elseif ($hasRole($user, Role::CAR_DRIVER->value)) {
                // For car drivers, check payment transaction
                $paymentTransaction = \App\Models\PaymentTransaction::where('shipment_id', $shipment->id)
                    ->where('rider_id', $user->id) // Note: column name is misleading, it stores collector user_id
                    ->where('transaction_type', 'car_driver_collection')
                    ->first();
            } elseif ($hasRole($user, Role::DROP_POINT_KEEPER->value)) {
                // For drop point keepers, check payment transaction
                $paymentTransaction = \App\Models\PaymentTransaction::where('shipment_id', $shipment->id)
                    ->where('rider_id', $user->id) // Note: column name is misleading, it stores collector user_id
                    ->where('transaction_type', 'drop_point_keeper_collection')
                    ->first();
            } else {
                return ApiResponse::badRequest(__('onlyRidersCarDriversOrDropPointKeepersCanDepositCash'));
            }

            if (! $paymentTransaction) {
                return ApiResponse::notFound(__('youHaveNotCollectedPaymentForThisShipment'));
            }

            // Check if payment has been collected from customer
            if ($paymentTransaction->status !== 'completed') {
                return ApiResponse::badRequest(__('paymentCollectionIsNotCompletedYet'));
            }

            // Check if already marked as deposited
            if ($paymentTransaction->rider_deposited_at) {
                return ApiResponse::badRequest(__('youHaveAlreadyMarkedThisAsDeposited'));
            }

            // Check if admin has already confirmed collection
            if ($paymentTransaction->settled_at || $shipment->adminSettlement) {
                return ApiResponse::badRequest(__('cashHasAlreadyBeenCollectedByAdmin'));
            }

            // Mark as deposited and update shipment status to Delivered
            // Depositing means the handover to admin is complete
            $paymentTransaction->update([
                'rider_deposited_at' => now(),
                'notes' => ($paymentTransaction->notes ? $paymentTransaction->notes.' | ' : '').
                    ($data['notes'] ?? __('markedAsDeposited')),
            ]);

            // Update shipment status to Delivered since handover is complete
            if ($shipment->payment_status == 'paid' && $shipment->sender_payment_status == 'paid') {
                $shipment->update([
                    'status' => 'Delivered',
                ]);
            }

            return ApiResponse::success(
                [
                    'shipment_id' => $shipment->id,
                    'ship_id' => 'MP'.str_pad($shipment->id, 7, '0', STR_PAD_LEFT),
                    'amount' => (int) ($paymentTransaction->amount ?? $shipment->parcel_amount ?? $shipment->total_fee),
                    'status' => 'Delivered',
                    'message' => __('cashDepositedSuccessfullyHandoverComplete'),
                ],
                __('cashDepositMarkedSuccessfully')
            );
        } catch (\Exception $e) {
            return ApiResponse::error($e->getMessage());
        }
    }

    /**
     * Get the nearest drop point keeper to the authenticated driver (rider).
     * Uses the driver's saved latitude/longitude in users table.
     */
    public function nearestDropPointKeeper(Request $request): JsonResponse
    {
        $driver = $request->user();

        // Optional role check: rider or car driver are eligible
        $names = array_map('strtolower', $driver->getRoleNames()->toArray());
        $isDriver = in_array(strtolower(Role::RIDER->value), $names, true)
            || in_array(strtolower(Role::CAR_DRIVER->value), $names, true);

        if (! $isDriver) {
            return ApiResponse::badRequest(__('onlyRidersOrDriversCanQueryNearestDropPointKeepers'));
        }

        if ($driver->latitude === null || $driver->longitude === null) {
            return ApiResponse::badRequest(__('driverLocationIsNotSetPleaseConfigureLatitudeLongitudeInProfile'));
        }

        $lat = (float) $driver->latitude;
        $lon = (float) $driver->longitude;

        $keeper = User::query()
            ->whereHas('roles', function ($q) {
                // Match common variants like 'Drop Point Keeper' or 'Drop-Point Keeper'
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

        if (! $keeper) {
            return ApiResponse::notFound(__('noDropPointKeeperWithAValidLocationIsConfigured'));
        }

        return ApiResponse::success([
            'keeper' => new UserResource($keeper),
            'distance_km' => isset($keeper->distance_km) ? round((float) $keeper->distance_km, 3) : null,
            'driver' => [
                'id' => $driver->id,
                'latitude' => $lat,
                'longitude' => $lon,
            ],
        ], __('nearestDropPointKeeperFetchedSuccessfully'));
    }

    /**
     * Statuses that indicate completion for any delivery role (rider, car driver, keeper).
     *
     * Includes all downstream indirect statuses so historical data that skipped
     * certain steps still counts as completed, but excludes
     * cancellation/failure statuses so they don't inflate earnings.
     */
    private function getCompletionStatuses(): array
    {
        return [
            ShipmentStatus::DELIVERED->value,
            ShipmentStatus::PICKED_UP_BY_RECEIVER->value,
            ShipmentStatus::DELIVERED_TO_DROP_POINT_1->value,
            ShipmentStatus::PENDING_HANDOVER->value,
            ShipmentStatus::DISPATCHED_TO_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_1->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE->value,
            ShipmentStatus::IN_TRANSIT_TO_WAREHOUSE_2->value,
            ShipmentStatus::ARRIVED_AT_WAREHOUSE_2->value,
            ShipmentStatus::DISPATCHED_FROM_WAREHOUSE_2->value,
            ShipmentStatus::PICKUP_FROM_WAREHOUSE_2->value,
            ShipmentStatus::IN_TRANSIT_TO_DROP_POINT_2->value,
            ShipmentStatus::ARRIVED_AT_DROP_POINT_2->value,
            ShipmentStatus::READY_FOR_PICKUP->value,
            ShipmentStatus::DISPATCHED_FROM_DROP_POINT_2->value,
            ShipmentStatus::PICKUP_FROM_DROP_POINT_2->value,
            ShipmentStatus::IN_TRANSIT_TO_CUSTOMER->value,
        ];
    }
}
