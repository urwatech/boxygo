<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\VehicleStoreRequest;
use App\Http\Resources\VehicleResource;
use App\Services\VehicleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function __construct(private VehicleService $vehicleService) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $vehicles = $user->vehicles;

        return ApiResponse::success(VehicleResource::collection($vehicles));
    }

    public function store(VehicleStoreRequest $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validated();

        if ($request->hasFile('photo')) {
            $data['photo_path'] = store_public_upload($request->file('photo'), 'vehicles', 'photos');
        }

        $data['user_id'] = $user->id;
        $vehicle = $this->vehicleService->create($data);

        return ApiResponse::created(
            new VehicleResource($vehicle),
            __('vehicleRegisteredSuccessfully')
        );
    }
}
