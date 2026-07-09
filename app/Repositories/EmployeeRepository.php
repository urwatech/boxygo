<?php

namespace App\Repositories;

use App\Contracts\EmployeeRepositoryInterface;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Repository for employee operations (users with employee roles).
 */
class EmployeeRepository extends AbstractRepository implements EmployeeRepositoryInterface
{
    public function __construct(User $model)
    {
        parent::__construct($model);
    }

    /**
     * Get all employees with their relationships.
     * For zone-assigned employees, only show employees from their zone.
     *
     * @return Collection
     */
    public function getAllEmployees(): Collection
    {
        $query = $this->model->newQuery()
            ->whereNotNull('employee_id')
            ->with(['roles:id,name,platform', 'roles.permissions:id,name']);

        // Apply zone filtering for non-superadmin employees
        $currentUser = auth()->user();
        if ($currentUser && !$currentUser->hasRole('superadmin') && $currentUser->zone_id && $currentUser->platform === 'Admin Portal') {
            $query->where('zone_id', $currentUser->zone_id);
        }

        return $query->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get employees by platform.
     *
     * @param string $platform
     * @return Collection
     */
    public function getByPlatform(string $platform): Collection
    {
        return $this->model->newQuery()
            ->whereNotNull('employee_id')
            ->where('platform', $platform)
            ->with(['roles:id,name,platform', 'roles.permissions:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Get employees by employment type.
     *
     * @param string $employmentType
     * @return Collection
     */
    public function getByEmploymentType(string $employmentType): Collection
    {
        return $this->model->newQuery()
            ->whereNotNull('employee_id')
            ->where('employment_type', $employmentType)
            ->with(['roles:id,name,platform', 'roles.permissions:id,name'])
            ->orderBy('created_at', 'desc')
            ->get();
    }

    /**
     * Find employee by employee_id.
     *
     * @param string $employeeId
     * @return \Illuminate\Database\Eloquent\Model|null
     */
    public function findByEmployeeId(string $employeeId)
    {
        return $this->model->newQuery()
            ->where('employee_id', $employeeId)
            ->with(['roles:id,name,platform', 'roles.permissions:id,name'])
            ->first();
    }
}
