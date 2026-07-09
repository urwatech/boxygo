<?php

namespace App\Http\Requests\Api\User;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDocumentsRequest extends FormRequest
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
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'driving_license' => 'nullable|file|mimes:pdf,jpeg,jpg,png|max:5120',
            'id_card_front' => 'nullable|file|mimes:pdf,jpeg,jpg,png|max:5120',
            'id_card_back' => 'nullable|file|mimes:pdf,jpeg,jpg,png|max:5120',
            'passport' => 'nullable|file|mimes:pdf,jpeg,jpg,png|max:5120',
            'idp' => 'nullable|file|mimes:pdf,jpeg,jpg,png|max:5120',
            'blood_group' => 'nullable|string|max:10',
            'emergency_contact' => 'nullable|string|max:20',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'driving_license.file' => __('validationMustBeValidFile'),
            'driving_license.mimes' => __('validationFileTypeNotAllowed'),
            'driving_license.max' => __('validationMustNotExceedMax'),
            'id_card_front.file' => __('validationMustBeValidFile'),
            'id_card_front.mimes' => __('validationFileTypeNotAllowed'),
            'id_card_front.max' => __('validationMustNotExceedMax'),
            'id_card_back.file' => __('validationMustBeValidFile'),
            'id_card_back.mimes' => __('validationFileTypeNotAllowed'),
            'id_card_back.max' => __('validationMustNotExceedMax'),
            'passport.file' => __('validationMustBeValidFile'),
            'passport.mimes' => __('validationFileTypeNotAllowed'),
            'passport.max' => __('validationMustNotExceedMax'),
            'idp.file' => __('validationMustBeValidFile'),
            'idp.mimes' => __('validationFileTypeNotAllowed'),
            'idp.max' => __('validationMustNotExceedMax'),
            'blood_group.string' => __('validationMustBeString'),
            'blood_group.max' => __('validationMustNotExceedMax'),
            'emergency_contact.string' => __('validationMustBeString'),
            'emergency_contact.max' => __('validationMustNotExceedMax'),
        ];
    }
}
