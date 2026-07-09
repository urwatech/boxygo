<?php

namespace App\Http\Requests\Customer\Auth;

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
        $firstName = trim((string) $this->input('first_name'));
        $lastNameRaw = trim((string) $this->input('last_name'));
        $lastName = $lastNameRaw === '' ? null : $lastNameRaw;
        $rawEmail = (string) $this->input('email', '');
        $sanitizedEmail = filter_var($rawEmail, FILTER_SANITIZE_EMAIL) ?? '';
        $sanitizedEmail = preg_replace('/[^\x20-\x7E]/', '', $sanitizedEmail);
        $email = strtolower(trim($sanitizedEmail));
        $phoneCodeInput = trim((string) $this->input('phone_code'));
        $rawPhoneInput = (string) $this->input('phone_number');

        $phoneCode = $phoneCodeInput !== '' ? $phoneCodeInput : '+963';
        $digits = preg_replace('/[^0-9]/', '', $rawPhoneInput);
        $codeDigits = preg_replace('/[^0-9]/', '', $phoneCode);
        $subscriberDigits = $digits;

        if ($codeDigits !== '' && str_starts_with($subscriberDigits, $codeDigits)) {
            $subscriberDigits = substr($subscriberDigits, strlen($codeDigits));
        }

        $subscriberDigits = substr($subscriberDigits, 0, 9);
        $formattedPhone = $subscriberDigits !== ''
            ? trim($phoneCode.' '.$subscriberDigits)
            : null;

        $this->merge([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'phone_code' => $formattedPhone ? $phoneCode : null,
            'phone_number' => $formattedPhone,
            'business_type' => $this->input('business_type') ? trim((string) $this->input('business_type')) : null,
            'country' => $this->input('country') ? trim((string) $this->input('country')) : null,
            'city' => $this->input('city') ? trim((string) $this->input('city')) : null,
            'address' => $this->input('address') ? trim((string) $this->input('address')) : null,
            'trade_license_number' => $this->input('trade_license_number') ? trim((string) $this->input('trade_license_number')) : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'email' => [
                'nullable',
                'string',
                'email',
                'max:255',
                'regex:/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/',
                'not_regex:/\bxn--/i',
                Rule::unique('users', 'email'),
            ],
            'phone_code' => ['required', 'string', 'max:10', 'required_with:phone_number'],
            'phone_number' => ['required', 'string', 'max:32', Rule::unique('users', 'phone_number')],
            'password' => [
                'required',
                'string',
                Password::min(6),
                'confirmed',
            ],
            'password_confirmation' => ['required_with:password', 'string'],
            'terms' => ['accepted'],
            'business_type' => ['nullable', 'string', 'max:100'],
            'country' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:500'],
            'trade_license_number' => ['nullable', 'string', 'max:100'],
            'license_copy' => ['nullable', 'file', 'mimes:png,jpg,jpeg,pdf', 'max:10240'],
        ];
    }

    public function messages(): array
    {
        return [
            'first_name.required' => __('validationFieldIsRequired'),
            'first_name.string' => __('validationMustBeString'),
            'first_name.max' => __('validationMustNotExceedMax'),
            'last_name.string' => __('validationMustBeString'),
            'last_name.max' => __('validationMustNotExceedMax'),
            'email.string' => __('validationMustBeString'),
            'email.email' => __('validationEmailInvalid'),
            'email.max' => __('validationMustNotExceedMax'),
            'email.regex' => __('validationFormatInvalid'),
            'email.not_regex' => __('validationFormatInvalid'),
            'email.unique' => __('validationValueAlreadyTaken'),
            'phone_code.required' => __('validationFieldIsRequired'),
            'phone_code.string' => __('validationMustBeString'),
            'phone_code.max' => __('validationMustNotExceedMax'),
            'phone_code.required_with' => __('validationRequiredWhenRelatedPresent'),
            'phone_number.required' => __('validationFieldIsRequired'),
            'phone_number.string' => __('validationMustBeString'),
            'phone_number.max' => __('validationMustNotExceedMax'),
            'phone_number.unique' => __('validationValueAlreadyTaken'),
            'password.required' => __('validationPasswordRequired'),
            'password.string' => __('validationMustBeString'),
            'password.min' => __('validationMustBeAtLeastMin'),
            'password.confirmed' => __('passwordConfirmed'),
            'password_confirmation.required_with' => __('validationRequiredWhenRelatedPresent'),
            'password_confirmation.string' => __('validationMustBeString'),
            'terms.accepted' => __('termsAccepted'),
            'business_type.string' => __('validationMustBeString'),
            'business_type.max' => __('validationMustNotExceedMax'),
            'country.string' => __('validationMustBeString'),
            'country.max' => __('validationMustNotExceedMax'),
            'city.string' => __('validationMustBeString'),
            'city.max' => __('validationMustNotExceedMax'),
            'address.string' => __('validationMustBeString'),
            'address.max' => __('validationMustNotExceedMax'),
            'trade_license_number.string' => __('validationMustBeString'),
            'trade_license_number.max' => __('validationMustNotExceedMax'),
            'license_copy.file' => __('validationMustBeValidFile'),
            'license_copy.mimes' => __('validationFileTypeNotAllowed'),
            'license_copy.max' => __('validationMustNotExceedMax'),
        ];
    }
}
