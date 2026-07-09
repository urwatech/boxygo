<?php

namespace App\Http\Requests\Api\Location;

use App\Rules\RejectSuspiciousText;
use Illuminate\Foundation\Http\FormRequest;

class LocationSearchRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'q' => trim((string) $this->query('q', '')),
            'country_code' => strtolower(trim((string) $this->query('country_code', 'sy'))),
            'limit' => $this->query('limit', 6),
        ]);
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:3', 'max:120', new RejectSuspiciousText()],
            'country_code' => ['nullable', 'string', 'regex:/^[a-z]{2,3}$/i'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:10'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'q.required' => __('validationFieldIsRequired'),
            'q.string' => __('validationMustBeString'),
            'q.min' => __('validationMustBeAtLeastMin'),
            'q.max' => __('validationMustNotExceedMax'),
            'country_code.string' => __('validationMustBeString'),
            'country_code.regex' => __('validationFormatInvalid'),
            'limit.integer' => __('validationMustBeInteger'),
            'limit.min' => __('validationMustBeAtLeastMin'),
            'limit.max' => __('validationMustNotExceedMax'),
        ];
    }
}
