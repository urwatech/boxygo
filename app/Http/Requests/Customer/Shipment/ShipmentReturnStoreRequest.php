<?php

namespace App\Http\Requests\Customer\Shipment;

use Illuminate\Foundation\Http\FormRequest;

class ShipmentReturnStoreRequest extends FormRequest
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
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'shipment_id' => 'required|exists:shipments,id',
            'remarks' => 'required|string',
            'photos' => 'array',
            'photos.*' => 'string',
            'payment_method' => 'required|string|in:cash,online',
        ];
    }

    public function messages(): array
    {
        return [
            'shipment_id.required' => __('shipmentIdRequired'),
            'shipment_id.exists' => __('commonShipmentNotFound'),
            'remarks.required' => __('validationFieldIsRequired'),
            'remarks.string' => __('validationMustBeString'),
            'photos.array' => __('validationMustBeArray'),
            'photos.*.string' => __('validationMustBeString'),
            'payment_method.required' => __('validationFieldIsRequired'),
            'payment_method.string' => __('validationMustBeString'),
            'payment_method.in' => __('validationSelectedValueInvalid'),
        ];
    }
}
