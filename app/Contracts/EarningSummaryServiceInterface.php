<?php

namespace App\Contracts;

interface EarningSummaryServiceInterface
{
    public function getStatistics(): array;

    public function paginateJobs(string $search = '', array $filters = [], int $perPage = 10): mixed;
}
