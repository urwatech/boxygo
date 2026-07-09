<?php

namespace App\Http\Requests\Api\Job;

use Illuminate\Foundation\Http\FormRequest;

class ScanParcelRequest extends FormRequest
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
        ];
    }

    /**
     * Normalize input before validation.
     *
     * Accept shipment ID from either the JSON body (shipment_id)
     * or the route parameter (id) so clients may call
     * POST /v1/jobs/scan-parcel/{id} without a body.
     */
    protected function prepareForValidation(): void
    {
        $routeId = $this->route('id');
        if ($routeId && !$this->has('shipment_id')) {
            $this->merge(['shipment_id' => $routeId]);
        }
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
        ];
    }
}
