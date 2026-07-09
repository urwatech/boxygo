<?php

namespace App\Http\Requests\Vehicle;

use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VehicleStatusUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if (!$user) {
            return false;
        }

        return $user->hasAnyPermission([
            'vehicles.manage',
            'vehicles.create',
        ]);
    }

    public function rules(): array
    {
        return [
            'status' => [
                'required',
                Rule::in([
                    Vehicle::STATUS_ACTIVE,
                    Vehicle::STATUS_PENDING_RENEWAL,
                    Vehicle::STATUS_INACTIVE,
                ]),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'status.required' => __('validationFieldIsRequired'),
            'status.in' => __('validationSelectedValueInvalid'),
        ];
    }
}
