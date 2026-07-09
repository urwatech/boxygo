<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class ResendOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'verification_token' => ['required_without:email', 'string', 'exists:user_otps,identifier'],
            'email' => ['required_without:verification_token', 'email', 'exists:users,email'],
        ];
    }

    public function messages(): array
    {
        return [
            'verification_token.required_without' => __('validationRequiredWhenRelatedMissing'),
            'verification_token.string' => __('validationMustBeString'),
            'verification_token.exists' => __('validationSelectedValueInvalid'),
            'email.required_without' => __('validationRequiredWhenRelatedMissing'),
            'email.email' => __('validationEmailInvalid'),
            'email.exists' => __('validationSelectedValueInvalid'),
        ];
    }
}
