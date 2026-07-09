<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\Role;
use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\Shelf\AssignShelfRequest;
use App\Http\Resources\ShelfResource;
use App\Services\ShelfService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Throwable;

class ShelfController extends Controller
{
    public function __construct(private readonly ShelfService $shelfService)
    {
        // Role middleware is applied in routes/api.php
    }

    public function index(Request $request): JsonResponse
    {
        $location = $request->query('location');
        $user = $request->user();
        $shelves = $this->shelfService->getAvailableShelves($location, $user);

        return ApiResponse::success(ShelfResource::collection($shelves));
    }

    public function assign(AssignShelfRequest $request): JsonResponse
    {
        $data = $request->validated();

        try {
            $result = $this->shelfService->assignShelfToShipment($data['shelf_id'], $data['shipment_id']);

            return ApiResponse::success([
                'shipment_id' => $result['shipment']->id,
                'shelf' => new ShelfResource($result['shelf']),
                'shelf_assigned_at' => $result['shipment']->shelf_assigned_at?->toIso8601String(),
            ], __('shelfAssignedSuccessfully'));
        } catch (ModelNotFoundException $e) {
            return ApiResponse::notFound($e->getMessage() ?: __('resourceNotFound'));
        } catch (RuntimeException $e) {
            return ApiResponse::badRequest($e->getMessage());
        } catch (Throwable $e) {
            report($e);

            return ApiResponse::serverError(__('unableToAssignShelfAtTheMoment'));
        }
    }
}
