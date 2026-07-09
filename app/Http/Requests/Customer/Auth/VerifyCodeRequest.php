<?php

namespace App\Http\Requests\Customer\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyCodeRequest extends FormRequest
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
            'code' => preg_replace('/[^0-9]/', '', (string) $this->input('code')),
        ]);
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email:rfc', 'exists:users,email'],
            'code' => ['required', 'string', 'size:4'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => __('validationFieldIsRequired'),
            'email.string' => __('validationMustBeString'),
            'email.email' => __('validationEmailInvalid'),
            'email.exists' => __('validationSelectedValueInvalid'),
            'code.required' => __('validationFieldIsRequired'),
            'code.string' => __('validationMustBeString'),
            'code.size' => __('validationMustBeExactSize'),
        ];
    }
}
