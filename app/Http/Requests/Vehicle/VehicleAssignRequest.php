<?php

namespace App\Http\Requests\Vehicle;

use Illuminate\Foundation\Http\FormRequest;

class VehicleAssignRequest extends FormRequest
{
    public function authorize(): bool
    {
        // return $this->user()?->hasRole('superadmin') ?? false;
        $user = $this->user();

        if (! $user) {
            return false;
        }

        return $user->hasAnyPermission([
            'vehicles.manage',
            'vehicles.assign',
        ]);
    }

    public function rules(): array
    {
        return [
            'user_id' => [
                'nullable',
                'integer',
                'exists:users,id',
                function ($attribute, $value, $fail) {
                    if ($value) {
                        $vehicle = $this->route('vehicle');

                        // Check if user is already assigned to this vehicle
                        if ($vehicle->user_id == $value) {
                            $fail('This person is already assigned to this vehicle.');

                            return;
                        }

                        // Check if user is already assigned to another vehicle
                        $existingAssignment = \App\Models\Vehicle::where('user_id', $value)
                            ->where('id', '!=', $vehicle->id)
                            ->first();

                        if ($existingAssignment) {
                            $fail('This person is already assigned to another vehicle (Code: '.$existingAssignment->code.').');
                        }
                    }
                },
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'user_id.integer' => __('validationMustBeInteger'),
            'user_id.exists' => __('validationSelectedValueInvalid'),
        ];
    }
}
