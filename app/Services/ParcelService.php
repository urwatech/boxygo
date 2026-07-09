<?php

namespace App\Services;

use App\Contracts\ParcelServiceInterface;
use App\Models\Parcel;
use App\Repositories\ParcelRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Service layer encapsulating parcel business logic.
 */
class ParcelService extends AbstractService implements ParcelServiceInterface
{
    protected ParcelRepository $parcelRepository;

    public function __construct(ParcelRepository $repository)
    {
        parent::__construct($repository);
        $this->parcelRepository = $repository;
    }

    public function paginateWithFilters(?string $search = null, array $filters = [], int $perPage = 10): LengthAwarePaginator
    {
        return $this->parcelRepository->paginateWithFilters($search, $filters, $perPage);
    }

    public function getStatistics(): array
    {
        $total = $this->parcelRepository->countAll();
        $active = $this->parcelRepository->countByStatus(Parcel::STATUS_ACTIVE);
        $inactive = $this->parcelRepository->countByStatus(Parcel::STATUS_INACTIVE);

        return [
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
        ];
    }
}
