<?php

namespace App\Http\Requests\Api\Job;

use Illuminate\Foundation\Http\FormRequest;

class CollectPaymentRequest extends FormRequest
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
            'shipment_id' => 'required|integer|exists:shipments,id',
            'collected_from' => 'nullable|string|in:sender,receiver',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'shipment_id.required' => __('shipmentIdRequired'),
            'shipment_id.integer' => __('shipmentIdInteger'),
            'shipment_id.exists' => __('commonShipmentNotFound'),

            'collected_from.string' => __('collectedFromString'),
            'collected_from.in' => __('collectedFromIn'),
        ];
    }
}
