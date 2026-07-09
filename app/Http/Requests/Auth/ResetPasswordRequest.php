<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class ResetPasswordRequest extends FormRequest
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
            'token' => ['required', 'string'],
            'email' => ['required', 'string', 'email:rfc', 'max:255'],
            'password' => [
                'required',
                'string',
                Password::min(6),
                'confirmed',
            ],
            'password_confirmation' => ['required_with:password', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'token.required' => __('validationFieldIsRequired'),
            'token.string' => __('validationMustBeString'),
            'email.required' => __('validationFieldIsRequired'),
            'email.string' => __('validationMustBeString'),
            'email.email' => __('validationEmailInvalid'),
            'email.max' => __('validationMustNotExceedMax'),
            'password.required' => __('validationPasswordRequired'),
            'password.string' => __('validationMustBeString'),
            'password.min' => __('validationMustBeAtLeastMin'),
            'password.confirmed' => __('passwordConfirmed'),
            'password_confirmation.required_with' => __('validationRequiredWhenRelatedPresent'),
            'password_confirmation.string' => __('validationMustBeString'),
        ];
    }
}
