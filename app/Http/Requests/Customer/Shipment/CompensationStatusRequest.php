<?php

namespace App\Http\Requests\Customer\Shipment;

use Illuminate\Foundation\Http\FormRequest;

class CompensationStatusRequest extends FormRequest
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
            'status' => 'required|in:approved,rejected',
            'remarks' => 'nullable|string',
        ];
    }

    public function messages(): array
    {
        return [
            'shipment_id.required' => __('shipmentIdRequired'),
            'shipment_id.exists' => __('commonShipmentNotFound'),
            'status.required' => __('validationFieldIsRequired'),
            'status.in' => __('validationSelectedValueInvalid'),
            'remarks.string' => __('validationMustBeString'),
        ];
    }
}
