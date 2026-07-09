<?php

namespace App\Http\Requests\Api\Job;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBarcodeRequest extends FormRequest
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
            'barcode_number' => ['required', 'string', 'max:255'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'barcode_number.required' => __('barcodeNumberRequired'),
            'barcode_number.string' => __('barcodeNumberString'),
            'barcode_number.max' => __('barcodeNumberMax'),
        ];
    }
}
