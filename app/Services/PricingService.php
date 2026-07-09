<?php

namespace App\Services;

use App\Contracts\PricingServiceInterface;
use App\Models\City;
use App\Models\CityShipmentPrice;
use App\Support\SortHelper;

class PricingService implements PricingServiceInterface
{
    private ?array $cachedCities = null;

    public function __construct(private readonly PriceCalculator $priceCalculator)
    {
    }

    public function getCities(): array
    {
        if ($this->cachedCities === null) {
            $this->cachedCities = City::query()
                ->orderBy('name')
                ->pluck('name')
                ->all();
        }

        return $this->cachedCities;
    }

    public function getPricingMatrix(string $search = '', int $perPage = 10): mixed
    {
        // TODO: Implement real database query
        $mockData = $this->getMockPricingMatrix();
        if ($search) {
            $mockData = array_filter($mockData, function ($item) use ($search) {
                return stripos($item['city_name'], $search) !== false;
            });
        }

        $total = count($mockData);
        $currentPage = request()->input('page', 1);
        $offset = ($currentPage - 1) * $perPage;
        $items = array_slice($mockData, $offset, $perPage);

        return new \Illuminate\Pagination\LengthAwarePaginator(
            $items,
            $total,
            $perPage,
            $currentPage,
            ['path' => request()->url(), 'query' => request()->query()]
        );
    }

    public function getAllPricingMatrix(string $search = ''): array
    {
        $mockData = $this->getMockPricingMatrix();
        if ($search) {
            $mockData = array_filter($mockData, function ($item) use ($search) {
                return stripos($item['city_name'], $search) !== false;
            });
        }

        return array_values($mockData);
    }

    private function getMockPricingMatrix(): array
    {
        // Get all cities with their governorate and type information
        $cities = City::query()
            ->with('governate')
            ->orderBy('name')
            ->get();

        $data = [];

        foreach ($cities as $index => $fromCity) {
            $row = [
                'id' => $index + 1,
                'city_name' => $fromCity->name,
                'prices' => [],
            ];

            foreach ($cities as $toCity) {
                // Use PriceCalculator to get actual price based on governorate and city type
                try {
                    $price = $this->priceCalculator->calculate(
                        fromGov: $fromCity->governate->short_code ?? $fromCity->governate_id,
                        fromType: $fromCity->type ?? 'M',
                        toGov: $toCity->governate->short_code ?? $toCity->governate_id,
                        toType: $toCity->type ?? 'M'
                    );
                    $row['prices'][$toCity->name] = number_format($price, 0, '.', ',');
                } catch (\Exception $e) {
                    // Fallback to base price if calculation fails
                    $row['prices'][$toCity->name] = '9,000';
                }
            }

            $data[] = $row;
        }

        return $data;
    }

    public function getAllZonesPrices(string $search = '', ?string $sortBy = null, ?string $sortDir = null)
    {
        $query = CityShipmentPrice::query()
            ->when($search !== '', function ($query) use ($search) {
                $like = "%{$search}%";

                $query->where('name', 'like', $like)
                    ->orWhere('price', 'like', $like)
                    ->orWhere('price1', 'like', $like)
                    ->orWhere('price2', 'like', $like)
                    ->orWhere('price3', 'like', $like)
                    ->orWhere('price4', 'like', $like)
                    ->orWhere('price5', 'like', $like)
                    ->orWhere('price6', 'like', $like);
            })
            ->orderBy(SortHelper::column($sortBy, [
                'id' => 'id',
                'name' => 'name',
                'price' => 'price',
                'price1' => 'price1',
                'price2' => 'price2',
                'price3' => 'price3',
                'price4' => 'price4',
                'price5' => 'price5',
                'price6' => 'price6',
                'created_at' => 'created_at',
                'updated_at' => 'updated_at',
            ], 'created_at'), SortHelper::direction($sortDir, 'desc'))
            ->orderByDesc('id');

        $data = $query->get()->map((function ($data) {
            return [
                'id' => $data->id,
                'name' => $data->name,
                'price' => $data->price,
                'price1' => $data->price1,
                'price2' => $data->price2,
                'price3' => $data->price3,
                'price4' => $data->price4,
                'price5' => $data->price5,
                'price6' => $data->price6,
                'created_at' => $data->created_at,
                'updated_at' => $data->updated_at,
            ];
        }));
 
        return $data;
    }
}
