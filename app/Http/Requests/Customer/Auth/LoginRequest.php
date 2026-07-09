<?php

namespace App\Http\Requests\Customer\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $rawLogin = trim((string) $this->input('email', ''));
        $normalizedEmail = $rawLogin !== '' && str_contains($rawLogin, '@')
            ? strtolower($rawLogin)
            : null;

        $normalizedPhone = null;
        if ($normalizedEmail === null && $rawLogin !== '') {
            $digits = preg_replace('/\D+/', '', $rawLogin);
            if ($digits !== '') {
                $normalizedPhone = $digits;
            }
        }

        $this->merge([
            'email' => $normalizedEmail,
            'phone_number' => $normalizedPhone,
            'remember' => filter_var($this->input('remember', false), FILTER_VALIDATE_BOOLEAN),
        ]);
    }

    public function rules(): array
    {
        return [
            'email' => ['nullable', 'string', 'email:rfc', 'max:255', 'required_without:phone_number'],
            'phone_number' => ['nullable', 'string', 'max:32', 'required_without:email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
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
            'remember.boolean' => __('validationMustBeBoolean'),
        ];
    }
}
