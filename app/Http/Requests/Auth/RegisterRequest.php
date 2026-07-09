<?php

namespace App\Http\Requests\Auth;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $rawEmail = $this->has('email') ? (string) $this->input('email') : '';
        $sanitizedEmail = $rawEmail !== '' ? (filter_var($rawEmail, FILTER_SANITIZE_EMAIL) ?? '') : '';
        $sanitizedEmail = $sanitizedEmail !== '' ? preg_replace('/[^\x20-\x7E]/', '', $sanitizedEmail) : '';
        $this->merge([
            'name' => $this->has('name') ? trim((string) $this->input('name')) : null,
            'email' => $sanitizedEmail !== '' ? strtolower(trim($sanitizedEmail)) : null,
            'phone_number' => $this->has('phone_number')
                ? preg_replace('/[^\d+]/', '', (string) $this->input('phone_number'))
                : null,
            'emergency_phone_number' => $this->has('emergency_phone_number')
                ? preg_replace('/[^\d+]/', '', (string) $this->input('emergency_phone_number'))
                : ($this->has('emergency_contact')
                    ? preg_replace('/[^\d+]/', '', (string) $this->input('emergency_contact'))
                    : null),
            'blood_type' => $this->has('blood_type')
                ? strtoupper(trim((string) $this->input('blood_type')))
                : ($this->has('blood_group')
                    ? strtoupper(trim((string) $this->input('blood_group')))
                    : null),
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                'regex:/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/',
                'not_regex:/\bxn--/i',
                Rule::unique('users', 'email'),
            ],
            'password' => [
                'required',
                'string',
                Password::min(6),
                'confirmed',
            ],
            'password_confirmation' => ['required_with:password', 'string'],
            'phone_number' => [
                'required',
                'string',
                'max:20',
                'regex:/^\+?[0-9]{10,15}$/',
                Rule::unique('users', 'phone_number'),
            ],
            'role' => [
                'required',
                'string',
                Rule::in([Role::RIDER->value, Role::DROP_POINT_KEEPER->value]),
            ],
            'emergency_phone_number' => [
                Rule::requiredIf(fn () => $this->input('role') === Role::RIDER->value),
                'string',
                'max:20',
                'regex:/^\+?[0-9]{10,15}$/',
            ],
            'blood_type' => [
                Rule::requiredIf(fn () => $this->input('role') === Role::RIDER->value),
                'string',
                'max:10',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => __('validationFieldIsRequired'),
            'name.string' => __('validationMustBeString'),
            'name.max' => __('validationMustNotExceedMax'),
            'email.required' => __('validationFieldIsRequired'),
            'email.string' => __('validationMustBeString'),
            'email.email' => __('validationEmailInvalid'),
            'email.max' => __('validationMustNotExceedMax'),
            'email.regex' => __('validationFormatInvalid'),
            'email.not_regex' => __('validationFormatInvalid'),
            'email.unique' => __('validationValueAlreadyTaken'),
            'password.required' => __('validationPasswordRequired'),
            'password.string' => __('validationMustBeString'),
            'password.min' => __('validationMustBeAtLeastMin'),
            'password.confirmed' => __('passwordConfirmed'),
            'password_confirmation.required_with' => __('validationRequiredWhenRelatedPresent'),
            'password_confirmation.string' => __('validationMustBeString'),
            'phone_number.required' => __('validationFieldIsRequired'),
            'phone_number.string' => __('validationMustBeString'),
            'phone_number.max' => __('validationMustNotExceedMax'),
            'phone_number.regex' => __('validationFormatInvalid'),
            'phone_number.unique' => __('validationValueAlreadyTaken'),
            'role.required' => __('validationFieldIsRequired'),
            'role.string' => __('validationMustBeString'),
            'role.in' => __('validationSelectedValueInvalid'),
            'emergency_phone_number.required' => __('validationFieldIsRequired'),
            'emergency_phone_number.string' => __('validationMustBeString'),
            'emergency_phone_number.max' => __('validationMustNotExceedMax'),
            'emergency_phone_number.regex' => __('validationFormatInvalid'),
            'blood_type.required' => __('validationFieldIsRequired'),
            'blood_type.string' => __('validationMustBeString'),
            'blood_type.max' => __('validationMustNotExceedMax'),
        ];
    }
}
