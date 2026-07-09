<?php

namespace App\Http\Requests\Vehicle;

use App\Models\Vehicle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VehicleManagementUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if (!$user) {
            return false;
        }

        return $user->hasAnyPermission([
            'vehicles.manage',
            'vehicles.create',
        ]);
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
        $vehicleId = $this->route('vehicle')?->id ?? null;

        return [
            'type' => ['required', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'model_year' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:50'],
            'license_plate' => [
                'required',
                'string',
                'max:20',
                Rule::unique('vehicles', 'license_plate')->ignore($vehicleId),
            ],
            'permit_expires_at' => ['nullable', 'date', 'after:today'],
            'insurance_expires_at' => ['nullable', 'date', 'after:today'],
            'status' => ['required', Rule::in([
                Vehicle::STATUS_ACTIVE,
                Vehicle::STATUS_PENDING_RENEWAL,
                Vehicle::STATUS_INACTIVE,
            ])],
            'vehicle_registration' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,docx', 'max:5120'],
            'car_insurance' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,docx', 'max:5120'],
            'operating_permit' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,docx', 'max:5120'],
            'additional_documents' => ['nullable', 'array'],
            'additional_documents.*' => ['file', 'mimes:pdf,jpg,jpeg,png,docx', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'type.required' => __('validationFieldIsRequired'),
            'type.string' => __('validationMustBeString'),
            'type.max' => __('validationMustNotExceedMax'),
            'model.string' => __('validationMustBeString'),
            'model.max' => __('validationMustNotExceedMax'),
            'model_year.string' => __('validationMustBeString'),
            'model_year.max' => __('validationMustNotExceedMax'),
            'color.string' => __('validationMustBeString'),
            'color.max' => __('validationMustNotExceedMax'),
            'license_plate.required' => __('validationFieldIsRequired'),
            'license_plate.string' => __('validationMustBeString'),
            'license_plate.max' => __('validationMustNotExceedMax'),
            'license_plate.unique' => __('validationValueAlreadyTaken'),
            'permit_expires_at.date' => __('validationMustBeValidDate'),
            'permit_expires_at.after' => __('validationDateMustBeAfter'),
            'insurance_expires_at.date' => __('validationMustBeValidDate'),
            'insurance_expires_at.after' => __('validationDateMustBeAfter'),
            'status.required' => __('validationFieldIsRequired'),
            'status.in' => __('validationSelectedValueInvalid'),
            'vehicle_registration.file' => __('validationMustBeValidFile'),
            'vehicle_registration.mimes' => __('validationFileTypeNotAllowed'),
            'vehicle_registration.max' => __('validationMustNotExceedMax'),
            'car_insurance.file' => __('validationMustBeValidFile'),
            'car_insurance.mimes' => __('validationFileTypeNotAllowed'),
            'car_insurance.max' => __('validationMustNotExceedMax'),
            'operating_permit.file' => __('validationMustBeValidFile'),
            'operating_permit.mimes' => __('validationFileTypeNotAllowed'),
            'operating_permit.max' => __('validationMustNotExceedMax'),
            'additional_documents.array' => __('validationMustBeArray'),
            'additional_documents.*.file' => __('validationMustBeValidFile'),
            'additional_documents.*.mimes' => __('validationFileTypeNotAllowed'),
            'additional_documents.*.max' => __('validationMustNotExceedMax'),
        ];
    }
}
