<?php

namespace App\Contracts;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Interfaces\BaseServiceInterface;

/**
 * Interface for employee service.
 */
interface EmployeeServiceInterface extends BaseServiceInterface
{
    /**
     * Get all employees with their roles.
     */
    public function getAllEmployees(): Collection;

    /**
     * Get employees by platform (Admin Portal / Mobile Application).
     */
    public function getEmployeesByPlatform(string $platform): Collection;

    /**
     * Get employees by employment type.
     */
    public function getEmployeesByEmploymentType(string $employmentType): Collection;

    /**
     * Get employee statistics grouped by role.
     */
    public function getEmployeeStatistics(): array;

    /**
     * Onboard a new employee (create user with employee role).
     *
     * @return array Returns employee and generated password
     */
    public function onboardEmployee(array $data): array;

    /**
     * Update employee information.
     */
    public function updateEmployee(int|string $employeeId, array $data): ?Model;

    /**
     * Get employee by employee_id.
     */
    public function findByEmployeeId(string $employeeId): ?Model;

    /**
     * Assign role to employee.
     */
    public function assignRole(int|string $employeeId, string $roleName): ?Model;
}
