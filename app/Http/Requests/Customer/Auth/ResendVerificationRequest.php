<?php

namespace App\Http\Requests\Customer\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ResendVerificationRequest extends FormRequest
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
            'email' => ['required', 'string', 'email:rfc', 'exists:users,email'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => __('validationFieldIsRequired'),
            'email.string' => __('validationMustBeString'),
            'email.email' => __('validationEmailInvalid'),
            'email.exists' => __('validationSelectedValueInvalid'),
        ];
    }
}
