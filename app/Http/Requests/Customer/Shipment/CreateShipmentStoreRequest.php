<?php

namespace App\Http\Requests\Customer\Shipment;

use Illuminate\Foundation\Http\FormRequest;

class CreateShipmentStoreRequest extends FormRequest
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
            'delivery_speed' => 'nullable|string',
            'indirect_delivery_mode' => 'nullable|string|in:door_to_door,door_to_drop_point,drop_point_to_door,drop_point_to_drop_point',
            'consignment_type' => 'nullable|string',
            'size' => 'nullable|string',
            'size_id' => 'nullable|integer|exists:parcels,id',
            'custom_length' => 'nullable|integer|min:1',
            'custom_width' => 'nullable|integer|min:1',
            'custom_height' => 'nullable|integer|min:1',
            'weight' => 'nullable|string',
            'parcel_amount' => 'nullable|numeric',
            'service_fee' => 'nullable|numeric',
            'insurance' => 'nullable|string',
            'insurance_fee' => 'nullable|numeric',
            'schedule_time' => 'nullable|string',

            'handover_address' => 'nullable|string',
            'handover_latitude' => 'nullable|numeric',
            'handover_longitude' => 'nullable|numeric',
            'delivery_address' => 'nullable|string',
            'delivery_latitude' => 'nullable|numeric',
            'delivery_longitude' => 'nullable|numeric',

            'sender_name' => 'nullable|string',
            'sender_phone' => 'nullable|string',
            'sender_email'   => 'nullable|email|different:receiver_email',
            'sender_landmark' => 'nullable|string',
            'sender_building' => 'nullable|string',
            'receiver_name' => 'nullable|string',
            'receiver_phone' => 'nullable|string',
            'receiver_email' => 'nullable|email|different:sender_email',
            'receiver_landmark' => 'nullable|string',
            'receiver_building' => 'nullable|string',

            'sender_zone_delivery_fee' => 'nullable|numeric',
            'reciever_zone_delivery_fee' => 'nullable|numeric',

            'accept_returns' => 'boolean',
            'return_window' => 'nullable|integer|required_if:accept_returns,true',
            'delivery_fee_payer' => 'required|string|in:sender,receiver',
            'return_delivery_fee_payer' => 'nullable|string|in:sender,receiver|required_if:accept_returns,true',
            'special_instruction' => 'nullable|string',
            'rdf_amount' => 'required|numeric',
            'sender_amount' => 'required|numeric',
            'reciever_amount' => 'required|numeric',
            'photos' => 'array',
            'photos.*' => 'string',
            'additional_docs' => 'array',
            'additional_docs.*' => 'string',

            'from_city_id' => 'required|exists:cities,id',
            'to_city_id' => 'required|exists:cities,id',

            'payment_method' => 'required|string|in:cash,online',
            'total_fee' => 'nullable|numeric',
        ];
    }

    public function messages(): array
    {
        return [
            'delivery_speed.string' => __('validationMustBeString'),
            'indirect_delivery_mode.string' => __('validationMustBeString'),
            'indirect_delivery_mode.in' => __('validationSelectedValueInvalid'),
            'consignment_type.string' => __('validationMustBeString'),
            'size.string' => __('validationMustBeString'),
            'size_id.integer' => __('validationMustBeInteger'),
            'size_id.exists' => __('validationSelectedValueInvalid'),
            'custom_length.integer' => __('validationMustBeInteger'),
            'custom_length.min' => __('validationMustBeAtLeastMin'),
            'custom_width.integer' => __('validationMustBeInteger'),
            'custom_width.min' => __('validationMustBeAtLeastMin'),
            'custom_height.integer' => __('validationMustBeInteger'),
            'custom_height.min' => __('validationMustBeAtLeastMin'),
            'weight.string' => __('validationMustBeString'),
            'parcel_amount.numeric' => __('validationMustBeNumeric'),
            'service_fee.numeric' => __('validationMustBeNumeric'),
            'insurance.string' => __('validationMustBeString'),
            'insurance_fee.numeric' => __('validationMustBeNumeric'),
            'schedule_time.string' => __('validationMustBeString'),
            'handover_address.string' => __('validationMustBeString'),
            'handover_latitude.numeric' => __('validationMustBeNumeric'),
            'handover_longitude.numeric' => __('validationMustBeNumeric'),
            'delivery_address.string' => __('validationMustBeString'),
            'delivery_latitude.numeric' => __('validationMustBeNumeric'),
            'delivery_longitude.numeric' => __('validationMustBeNumeric'),
            'sender_name.string' => __('validationMustBeString'),
            'sender_phone.string' => __('validationMustBeString'),
            'sender_email.email' => __('validationEmailInvalid'),
            'sender_email.different' => __('validationMustDifferFromRelated'),
            'sender_landmark.string' => __('validationMustBeString'),
            'sender_building.string' => __('validationMustBeString'),
            'receiver_name.string' => __('validationMustBeString'),
            'receiver_phone.string' => __('validationMustBeString'),
            'receiver_email.email' => __('validationEmailInvalid'),
            'receiver_email.different' => __('validationMustDifferFromRelated'),
            'receiver_landmark.string' => __('validationMustBeString'),
            'receiver_building.string' => __('validationMustBeString'),
            'sender_zone_delivery_fee.numeric' => __('validationMustBeNumeric'),
            'reciever_zone_delivery_fee.numeric' => __('validationMustBeNumeric'),
            'accept_returns.boolean' => __('validationMustBeBoolean'),
            'return_window.integer' => __('validationMustBeInteger'),
            'return_window.required_if' => __('validationRequiredForSelectedCondition'),
            'delivery_fee_payer.required' => __('validationFieldIsRequired'),
            'delivery_fee_payer.string' => __('validationMustBeString'),
            'delivery_fee_payer.in' => __('validationSelectedValueInvalid'),
            'return_delivery_fee_payer.string' => __('validationMustBeString'),
            'return_delivery_fee_payer.in' => __('validationSelectedValueInvalid'),
            'return_delivery_fee_payer.required_if' => __('validationRequiredForSelectedCondition'),
            'special_instruction.string' => __('validationMustBeString'),
            'rdf_amount.required' => __('validationFieldIsRequired'),
            'rdf_amount.numeric' => __('validationMustBeNumeric'),
            'sender_amount.required' => __('validationFieldIsRequired'),
            'sender_amount.numeric' => __('validationMustBeNumeric'),
            'reciever_amount.required' => __('validationFieldIsRequired'),
            'reciever_amount.numeric' => __('validationMustBeNumeric'),
            'photos.array' => __('validationMustBeArray'),
            'photos.*.string' => __('validationMustBeString'),
            'additional_docs.array' => __('validationMustBeArray'),
            'additional_docs.*.string' => __('validationMustBeString'),
            'from_city_id.required' => __('validationFieldIsRequired'),
            'from_city_id.exists' => __('validationSelectedValueInvalid'),
            'to_city_id.required' => __('validationFieldIsRequired'),
            'to_city_id.exists' => __('validationSelectedValueInvalid'),
            'payment_method.required' => __('validationFieldIsRequired'),
            'payment_method.string' => __('validationMustBeString'),
            'payment_method.in' => __('validationSelectedValueInvalid'),
            'total_fee.numeric' => __('validationMustBeNumeric'),
        ];
    }
}
