<?php

namespace App\Http\Requests\Api\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            'name' => 'sometimes|string|max:255',
            'email' => [
                'sometimes',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'phone_number' => [
                'sometimes',
                'string',
                'max:20',
                Rule::unique('users', 'phone_number')->ignore($userId),
            ],
            'avatar' => 'sometimes|nullable|image|mimes:jpeg,jpg,png|max:2048',
            'governorate' => 'sometimes|nullable|string|max:255',
            'dob' => 'sometimes|nullable|date|before:today',
            'gender' => 'sometimes|nullable|in:male,female,other',
            'email_notifications' => 'sometimes|boolean',
            'push_notifications' => 'sometimes|boolean',
            'availability' => 'sometimes|in:online,offline,busy',
            'language' => 'sometimes|nullable|string|max:10',
            'blood_group' => 'sometimes|nullable|string|max:10',
            'emergency_contact' => 'sometimes|nullable|string|max:20',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.string' => __('validationMustBeString'),
            'name.max' => __('validationMustNotExceedMax'),
            'email.email' => __('validationEmailInvalid'),
            'email.max' => __('validationMustNotExceedMax'),
            'email.unique' => __('validationValueAlreadyTaken'),
            'phone_number.string' => __('validationMustBeString'),
            'phone_number.max' => __('validationMustNotExceedMax'),
            'phone_number.unique' => __('validationValueAlreadyTaken'),
            'avatar.image' => __('validationMustBeImage'),
            'avatar.mimes' => __('validationFileTypeNotAllowed'),
            'avatar.max' => __('validationMustNotExceedMax'),
            'governorate.string' => __('validationMustBeString'),
            'governorate.max' => __('validationMustNotExceedMax'),
            'dob.date' => __('validationMustBeValidDate'),
            'dob.before' => __('dobBefore'),
            'gender.in' => __('validationSelectedValueInvalid'),
            'email_notifications.boolean' => __('validationMustBeBoolean'),
            'push_notifications.boolean' => __('validationMustBeBoolean'),
            'availability.in' => __('validationSelectedValueInvalid'),
            'language.string' => __('validationMustBeString'),
            'language.max' => __('validationMustNotExceedMax'),
            'blood_group.string' => __('validationMustBeString'),
            'blood_group.max' => __('validationMustNotExceedMax'),
            'emergency_contact.string' => __('validationMustBeString'),
            'emergency_contact.max' => __('validationMustNotExceedMax'),
        ];
    }
}
