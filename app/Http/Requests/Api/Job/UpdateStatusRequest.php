<?php

namespace App\Http\Requests\Api\Job;

use App\Enums\ShipmentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStatusRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'status' => [
                'required',
                'string',
                // Accept any valid ShipmentStatus value (string)
                Rule::in(array_map(fn (ShipmentStatus $s) => $s->value, ShipmentStatus::cases())),
            ],
            'current_index' => 'sometimes|integer|min:0',
            'verification_code' => [
                // Require code only for final handover to receiver:
                // - Direct delivery: when marking as DELIVERED
                // - Indirect delivery: when marking as PICKED_UP_BY_RECEIVER
                Rule::requiredIf(function () {
                    $status = $this->input('status') ?? null;
                    $shipment = $this->route('id') ? \App\Models\Shipment::find($this->route('id')) : null;
                    $deliverySpeed = $shipment?->delivery_speed ?? 'direct';

                    if ($deliverySpeed === 'direct' && $status === ShipmentStatus::DELIVERED->value) {
                            return true;
                        }

                        if ($deliverySpeed === 'indirect' && $status === ShipmentStatus::PICKED_UP_BY_RECEIVER->value) {
                            return true;
                        }

                    return false;
                }),
                'nullable',
                'string',
                'size:6',
            ],
            // Optional location; if absent we will fallback to driver's saved coordinates
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }

    /**
     * Normalize input before validation.
     * - Allow using status slugs (e.g., in_transit) by converting to enum value.
     */
    protected function prepareForValidation(): void
    {
        $status = $this->input('status');
        if (is_string($status)) {
            // If already an exact enum value, keep it; otherwise try slug mapping
            $enumValues = array_map(fn (ShipmentStatus $s) => $s->value, ShipmentStatus::cases());
            if (!in_array($status, $enumValues, true)) {
                $fromSlug = ShipmentStatus::fromSlug($status);
                if ($fromSlug) {
                    $this->merge(['status' => $fromSlug->value]);
                }
            }
        }
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'status.required' => __('validationFieldIsRequired'),
            'status.string' => __('validationMustBeString'),
            'status.in' => __('validationSelectedValueInvalid'),
            'current_index.integer' => __('validationMustBeInteger'),
            'current_index.min' => __('validationMustBeAtLeastMin'),
            'verification_code.required' => __('validationFieldIsRequired'),
            'verification_code.string' => __('validationMustBeString'),
            'verification_code.size' => __('validationMustBeExactSize'),
            'latitude.numeric' => __('validationMustBeNumeric'),
            'latitude.between' => __('validationMustBeBetween'),
            'longitude.numeric' => __('validationMustBeNumeric'),
            'longitude.between' => __('validationMustBeBetween'),
        ];
    }
}
