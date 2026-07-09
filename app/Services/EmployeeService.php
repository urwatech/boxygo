<?php

namespace App\Services;

use App\Contracts\EmployeeServiceInterface;
use App\Enums\Role;
use App\Repositories\EmployeeRepository;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Service layer for employee-related logic.
 */
class EmployeeService extends AbstractService implements EmployeeServiceInterface
{
    public function __construct(EmployeeRepository $repository)
    {
        parent::__construct($repository);
    }

    /**
     * Get all employees with their roles.
     */
    public function getAllEmployees(): Collection
    {
        return $this->repository->getAllEmployees();
    }

    /**
     * Get employees by platform (Admin Portal / Mobile Application).
     */
    public function getEmployeesByPlatform(string $platform): Collection
    {
        return $this->repository->getByPlatform($platform);
    }

    /**
     * Get employees by employment type.
     */
    public function getEmployeesByEmploymentType(string $employmentType): Collection
    {
        return $this->repository->getByEmploymentType($employmentType);
    }

    /**
     * Get employee statistics grouped by role.
     * Statistics are automatically filtered by zone for zone-assigned employees.
     */
    public function getEmployeeStatistics(): array
    {
        // getAllEmployees() already applies zone filtering in the repository
        $employees = $this->repository->getAllEmployees();

        // Group by role type
        $stats = [];

        // Count by specific roles (based on design)
        $stats['bike_riders'] = $employees->filter(function ($emp) {
            return $emp->roles->contains('name', Role::RIDER->value);
        })->count();

        $stats['car_drivers'] = $employees->filter(function ($emp) {
            return $emp->roles->contains('name', Role::CAR_DRIVER->value);
        })->count();

        $stats['drop_point_keepers'] = $employees->filter(function ($emp) {
            return $emp->roles->contains('name', Role::DROP_POINT_KEEPER->value);
        })->count();

        $stats['warehouse_keepers'] = $employees->filter(function ($emp) {
            return $emp->roles->contains('name', Role::WAREHOUSE_KEEPER->value);
        })->count();

        $stats['total'] = $employees->count();

        return $stats;
    }

    /**
     * Onboard a new employee (create user with employee role).
     *
     * @return array Returns employee and generated password
     */
    public function onboardEmployee(array $data): array
    {
        DB::beginTransaction();

        try {
            // Generate employee ID if not provided
            if (! isset($data['employee_id'])) {
                $data['employee_id'] = $this->generateEmployeeId();
            }

            // Generate random password if not provided
            $plainPassword = app()->environment('local') ? '123456' : ($data['password'] ?? $this->generateRandomPassword());
            $data['password'] = Hash::make($plainPassword);

            // Set default values
            $data['member_since'] = $data['member_since'] ?? now();

            // Admin Portal employees should be active by default, Mobile App users start as pending
            if (! isset($data['status'])) {
                $data['status'] = ($data['platform'] ?? '') === 'Admin Portal' ? 'active' : 'pending';
            }

            // Auto-assign zone if coordinates provided but no zone_id
            if (! isset($data['zone_id']) && isset($data['latitude']) && isset($data['longitude'])) {
                $zone = ZoneHelper::findZoneByCoordinates($data['latitude'], $data['longitude']);
                if ($zone) {
                    $data['zone_id'] = $zone->id;
                }
            }

            // Create employee user
            $employee = $this->repository->create($data);

            // Assign role if provided
            if (isset($data['role']) && $employee) {
                $employee->assignRole($data['role']);
            }

            DB::commit();

            return [
                'employee' => $employee,
                'password' => $plainPassword,
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Generate a random secure password.
     */
    private function generateRandomPassword(): string
    {
        $uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        $lowercase = 'abcdefghjkmnpqrstuvwxyz';
        $numbers = '23456789';
        $special = '!@#$%^&*';

        // Ensure at least one character from each set
        $password = '';
        $password .= $uppercase[random_int(0, strlen($uppercase) - 1)];
        $password .= $lowercase[random_int(0, strlen($lowercase) - 1)];
        $password .= $numbers[random_int(0, strlen($numbers) - 1)];
        $password .= $special[random_int(0, strlen($special) - 1)];

        // Fill the rest with random characters
        $allChars = $uppercase.$lowercase.$numbers.$special;
        for ($i = 0; $i < 8; $i++) {
            $password .= $allChars[random_int(0, strlen($allChars) - 1)];
        }

        // Shuffle the password
        $password = str_shuffle($password);

        return $password;
    }

    /**
     * Update employee information.
     */
    public function updateEmployee(int|string $employeeId, array $data): ?Model
    {
        DB::beginTransaction();

        try {
            $existingEmployee = $this->repository->find($employeeId);

            if (! $existingEmployee) {
                DB::rollBack();

                return null;
            }

            // Hash password if provided
            if (isset($data['password'])) {
                $data['password'] = Hash::make($data['password']);
            }

            $shouldNormalizeZoneAssignment = array_key_exists('zone_id', $data) || array_key_exists('zone_ids', $data);

            if ($shouldNormalizeZoneAssignment) {
                $data = $this->normalizeZoneAssignment($data);
            }

            // Auto-assign zone if coordinates changed but no zone_id provided
            if (! isset($data['zone_id']) && isset($data['latitude']) && isset($data['longitude'])) {
                $zone = ZoneHelper::findZoneByCoordinates($data['latitude'], $data['longitude']);
                if ($zone) {
                    $data['zone_id'] = $zone->id;
                }
            }

            // Persist changes via repository
            $originalStatus = $existingEmployee->status;
            $updated = $this->repository->update($employeeId, $data);

            if (! $updated) {
                DB::rollBack();

                return null;
            }

            // Fetch the fresh employee model for downstream operations
            $existingEmployee->refresh();
            $employee = $existingEmployee;

            // Update role if provided
            if ($employee && isset($data['role'])) {
                $employee->syncRoles([$data['role']]);
            }

            if ($employee && isset($data['status']) && $data['status'] !== 'active' && $originalStatus === 'active') {
                // Force logout once an active employee becomes blocked/pending
                $employee->tokens()->delete();
            }

            DB::commit();

            return $employee;
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }

    /**
     * Get employee by employee_id.
     */
    public function findByEmployeeId(string $employeeId): ?Model
    {
        return $this->repository->findByEmployeeId($employeeId);
    }

    private function normalizeZoneAssignment(array $data): array
    {
        $zoneIds = [];

        if (array_key_exists('zone_ids', $data)) {
            if (is_array($data['zone_ids'])) {
                $zoneIds = $data['zone_ids'];
            } elseif ($data['zone_ids'] !== null && $data['zone_ids'] !== '') {
                $zoneIds = [$data['zone_ids']];
            }
        }

        $zoneIds = array_values(array_filter(array_map(static function ($zoneId) {
            if ($zoneId === null || $zoneId === '') {
                return null;
            }

            return (int) $zoneId;
        }, $zoneIds), static fn ($zoneId) => $zoneId !== null));

        if (empty($zoneIds) && ! empty($data['zone_id'])) {
            $zoneIds = [(int) $data['zone_id']];
        }

        $zoneIds = array_values(array_unique($zoneIds));
        $data['zone_ids'] = $zoneIds;

        if (empty($data['zone_id'])) {
            $data['zone_id'] = $zoneIds[0] ?? null;
        }

        return $data;
    }

    /**
     * Assign role to employee.
     */
    public function assignRole(int|string $employeeId, string $roleName): ?Model
    {
        $employee = $this->find($employeeId);

        if ($employee) {
            $employee->assignRole($roleName);
        }

        return $employee;
    }

    /**
     * Generate a unique employee ID in format R-001.
     */
    private function generateEmployeeId(): string
    {
        // Get the last employee with an ID matching R-XXX pattern
        $lastEmployee = $this->repository->getModel()
            ->whereNotNull('employee_id')
            ->where('employee_id', 'like', 'R-%')
            ->orderByRaw('CAST(SUBSTRING(employee_id, 3) AS UNSIGNED) DESC')
            ->first();

        if ($lastEmployee && $lastEmployee->employee_id) {
            // Extract the number from R-XXX format
            $lastNumber = (int) substr($lastEmployee->employee_id, 2);
            $newNumber = $lastNumber + 1;
        } else {
            // Start from 1 if no employees exist
            $newNumber = 1;
        }

        // Format as R-001, R-002, etc.
        return 'R-'.str_pad($newNumber, 3, '0', STR_PAD_LEFT);
    }
}
