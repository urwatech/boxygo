<?php

namespace App\Http\Requests\Vehicle;

use Illuminate\Foundation\Http\FormRequest;

class VehicleStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('license_plate')) {
            $this->merge([
                'license_plate' => strtoupper((string) $this->input('license_plate')),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', 'max:100'],
            'make' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:50'],
            'license_plate' => ['required', 'string', 'max:20', 'unique:vehicles,license_plate'],
            'photo' => ['nullable', 'image', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => __('validationFieldIsRequired'),
            'type.string' => __('validationMustBeString'),
            'type.max' => __('validationMustNotExceedMax'),
            'make.string' => __('validationMustBeString'),
            'make.max' => __('validationMustNotExceedMax'),
            'model.string' => __('validationMustBeString'),
            'model.max' => __('validationMustNotExceedMax'),
            'color.string' => __('validationMustBeString'),
            'color.max' => __('validationMustNotExceedMax'),
            'license_plate.required' => __('validationFieldIsRequired'),
            'license_plate.string' => __('validationMustBeString'),
            'license_plate.max' => __('validationMustNotExceedMax'),
            'license_plate.unique' => __('validationValueAlreadyTaken'),
            'photo.image' => __('validationMustBeImage'),
            'photo.max' => __('validationMustNotExceedMax'),
        ];
    }
}
