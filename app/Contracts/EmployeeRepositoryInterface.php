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
     *
     * @return Collection
     */
    public function getAllEmployees(): Collection;

    /**
     * Get employees by platform.
     *
     * @param string $platform
     * @return Collection
     */
    public function getByPlatform(string $platform): Collection;

    /**
     * Get employees by employment type.
     *
     * @param string $employmentType
     * @return Collection
     */
    public function getByEmploymentType(string $employmentType): Collection;

    /**
     * Find employee by employee_id.
     *
     * @param string $employeeId
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public function findByEmployeeId(string $employeeId);
}
