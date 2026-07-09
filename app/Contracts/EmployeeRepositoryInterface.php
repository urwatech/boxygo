<?php

namespace App\Contracts;

use Illuminate\Support\Collection;
use Interfaces\BaseRepositoryInterface;

/**
 * Interface for employee repository.
 */
interface EmployeeRepositoryInterface extends BaseRepositoryInterface
{
    /**
     * Get all employees (users with employee roles) with their relationships.
     */
    public function getAllEmployees(): Collection;

    /**
     * Get employees by platform.
     */
    public function getByPlatform(string $platform): Collection;

    /**
     * Get employees by employment type.
     */
    public function getByEmploymentType(string $employmentType): Collection;

    /**
     * Find employee by employee_id.
     *
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public function findByEmployeeId(string $employeeId);
}
