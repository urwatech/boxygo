<?php

namespace App\Http\Requests\Customer\Shipment;

use Illuminate\Foundation\Http\FormRequest;

class CompensationStoreRequest extends FormRequest
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
            'amount' => 'required|numeric',
            'remarks' => 'nullable|string',
            'photos' => 'array',
            'photos.*' => 'string',
        ];
    }

    public function messages(): array
    {
        return [
            'shipment_id.required' => __('shipmentIdRequired'),
            'shipment_id.exists' => __('commonShipmentNotFound'),
            'amount.required' => __('validationFieldIsRequired'),
            'amount.numeric' => __('validationMustBeNumeric'),
            'remarks.string' => __('validationMustBeString'),
            'photos.array' => __('validationMustBeArray'),
            'photos.*.string' => __('validationMustBeString'),
        ];
    }
}
