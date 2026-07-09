<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyOtpRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'verification_token' => ['required', 'string', 'exists:user_otps,identifier'],
            'code' => ['required', 'digits:6'],
        ];
    }

    public function messages(): array
    {
        return [
            'verification_token.required' => __('validationFieldIsRequired'),
            'verification_token.string' => __('validationMustBeString'),
            'verification_token.exists' => __('validationSelectedValueInvalid'),
            'code.required' => __('validationFieldIsRequired'),
            'code.digits' => __('codeDigits'),
        ];
    }
}
