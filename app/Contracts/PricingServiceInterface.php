<?php

namespace App\Contracts;

interface PricingServiceInterface
{
    public function getPricingMatrix(string $search = '', int $perPage = 10): mixed;

    public function getCities(): array;
}
