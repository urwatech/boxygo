<?php

namespace App\Http\Requests\Api\User;

use Illuminate\Foundation\Http\FormRequest;

class DepositCashRequest extends FormRequest
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
            'shipment_id' => 'required|integer|exists:shipments,id',
            'notes' => 'nullable|string|max:500',
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
            'notes.string' => __('validationMustBeString'),
            'notes.max' => __('validationMustNotExceedMax'),
        ];
    }
}
