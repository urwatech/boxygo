<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ForgotPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => $this->has('email')
                ? strtolower(trim((string) $this->input('email')))
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'email' => ['nullable', 'email', 'exists:users,email', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.email' => __('validationEmailInvalid'),
            'email.exists' => __('validationSelectedValueInvalid'),
            'email.required_without' => __('validationRequiredWhenRelatedMissing'),
            'phone_number.string' => __('validationMustBeString'),
            'phone_number.max' => __('validationMustNotExceedMax'),
            'phone_number.required_without' => __('validationRequiredWhenRelatedMissing'),
        ];
    }
}
