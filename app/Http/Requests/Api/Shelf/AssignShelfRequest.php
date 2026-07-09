<?php

namespace App\Http\Requests\Api\Shelf;

use Illuminate\Foundation\Http\FormRequest;

class AssignShelfRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shipment_id' => ['required', 'integer', 'exists:shipments,id'],
            'shelf_id' => ['required', 'integer', 'exists:shelves,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'shipment_id.required' => __('shipmentIdRequired'),
            'shipment_id.integer' => __('shipmentIdInteger'),
            'shipment_id.exists' => __('commonShipmentNotFound'),
            'shelf_id.required' => __('validationFieldIsRequired'),
            'shelf_id.integer' => __('validationMustBeInteger'),
            'shelf_id.exists' => __('validationSelectedValueInvalid'),
        ];
    }
}
