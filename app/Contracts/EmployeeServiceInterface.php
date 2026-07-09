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
     *
     * @return Collection
     */
    public function getAllEmployees(): Collection;

    /**
     * Get employees by platform (Admin Portal / Mobile Application).
     *
     * @param string $platform
     * @return Collection
     */
    public function getEmployeesByPlatform(string $platform): Collection;

    /**
     * Get employees by employment type.
     *
     * @param string $employmentType
     * @return Collection
     */
    public function getEmployeesByEmploymentType(string $employmentType): Collection;

    /**
     * Get employee statistics grouped by role.
     *
     * @return array
     */
    public function getEmployeeStatistics(): array;

    /**
     * Onboard a new employee (create user with employee role).
     *
     * @param array $data
     * @return array Returns employee and generated password
     */
    public function onboardEmployee(array $data): array;

    /**
     * Update employee information.
     *
     * @param int|string $employeeId
     * @param array $data
     * @return Model|null
     */
    public function updateEmployee(int|string $employeeId, array $data): ?Model;

    /**
     * Get employee by employee_id.
     *
     * @param string $employeeId
     * @return Model|null
     */
    public function findByEmployeeId(string $employeeId): ?Model;

    /**
     * Assign role to employee.
     *
     * @param int|string $employeeId
     * @param string $roleName
     * @return Model|null
     */
    public function assignRole(int|string $employeeId, string $roleName): ?Model;
}
