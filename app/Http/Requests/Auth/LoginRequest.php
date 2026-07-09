<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => $this->has('email')
                ? strtolower(trim((string) $this->input('email')))
                : null,
            'phone_number' => $this->has('phone_number')
                ? (string) $this->input('phone_number')
                : null,
        ]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['nullable', 'string', 'email:rfc', 'max:255', 'required_without:phone_number'],
            'phone_number' => [
                'nullable',
                'string',
                'max:20',
                // 'regex:/^\+?[0-9]{10,15}$/',
                'required_without:email',
            ],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.string' => __('validationMustBeString'),
            'email.email' => __('validationEmailInvalid'),
            'email.max' => __('validationMustNotExceedMax'),
            'email.required_without' => __('validationRequiredWhenRelatedMissing'),
            'phone_number.string' => __('validationMustBeString'),
            'phone_number.max' => __('validationMustNotExceedMax'),
            'phone_number.required_without' => __('validationRequiredWhenRelatedMissing'),
            'password.required' => __('validationPasswordRequired'),
            'password.string' => __('validationMustBeString'),
        ];
    }
}
