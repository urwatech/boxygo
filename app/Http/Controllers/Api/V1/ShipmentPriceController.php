<?php
 
namespace App\Http\Controllers\Api\V1;

use App\Enums\Parcels;
use App\Http\Controllers\Controller;
use App\Models\City;
use App\Models\CityShipmentPrice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
 
class ShipmentPriceController extends Controller
{
    public function __construct() {}

    private function mapCityName(string $cityName): string
    {
        $map = [
            'Latakia' => 'Lattakia',
            'Jableh' => 'Jable',
            'Baniyas' => 'Banyas',
            'Qamishli' => 'Al-Qamishli',
            'Damascus' => 'Damascus City',
            // Add any future spelling discrepancies here
        ];
 
        return $map[$cityName] ?? $cityName;
    }
 
    public function calculate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_city_id' => 'required|exists:cities,id',
            'to_city_id' => 'required|exists:cities,id',
            'handover_latitude' => 'required|numeric',
            'handover_longitude' => 'required|numeric',
            'delivery_latitude' => 'required|numeric',
            'delivery_longitude' => 'required|numeric',
            'size_id' => 'nullable|exists:parcels,id',
            'force_indirect' => 'nullable|boolean',
        ]);
        $forceIndirect = filter_var($validated['force_indirect'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $sizeId = $validated['size_id'];
        $parcel = $sizeId ? \App\Models\Parcel::find($sizeId) : null;
 
        // Find Zones
        $pickupZone = \App\Services\ZoneHelper::findZoneByCoordinates($validated['handover_latitude'], $validated['handover_longitude']);
        $dropOffZone = \App\Services\ZoneHelper::findZoneByCoordinates($validated['delivery_latitude'], $validated['delivery_longitude']);

        if (!$pickupZone || !$dropOffZone) {
            return response()->json([
                'success' => true,
                'data' => null
            ]);
        }

        if (!$parcel) {
            return response()->json([
                'success' => true,
                'data' => [
                    'type' => $forceIndirect
                        ? 'indirect'
                        : (($validated['from_city_id'] == $validated['to_city_id']) ? 'direct' : 'indirect'),
                    'total' => 0,
                    'sender_price' => 0,
                    'reciever_price' => 0,
                    'service_fee' => 0
                ],
            ]);
        }

        $data = null;

        // 1. Direct Delivery Flow
        if (!$forceIndirect && $validated['from_city_id'] == $validated['to_city_id']) {
            $senderPrice = CityShipmentPrice::where('sender_sub_district_id', $pickupZone->sub_district_name)->first();
            if ($parcel->name == Parcels::BAG_1->value) {
                $data = [
                    'type' => 'direct',
                    'total' => $senderPrice->price1 ?? 0,
                    'service_fee' => $pickupZone->direct_srv_fees ?? 0
                ];
            } else if ($parcel->name == Parcels::BAG_2->value) {
                $data = [
                    'type' => 'direct',
                    'total' => $senderPrice->price2 ?? 0,
                    'service_fee' => $pickupZone->direct_srv_fees ?? 0
                ];
            } else if ($parcel->name == Parcels::BAG_3->value) {
                $data = [
                    'type' => 'direct',
                    'total' => $senderPrice->price3 ?? 0,
                    'service_fee' => $pickupZone->direct_srv_fees ?? 0
                ];
            } else if ($parcel->name == Parcels::BAG_4->value) {
                $data = [
                    'type' => 'direct',
                    'total' => $senderPrice->price4 ?? 0,
                    'service_fee' => $pickupZone->direct_srv_fees ?? 0
                ];
            } else if ($parcel->name == Parcels::BAG_5->value) {
                $data = [
                    'type' => 'direct',
                    'total' => $senderPrice->price5 ?? 0,
                    'service_fee' => $pickupZone->direct_srv_fees ?? 0
                ];
            } else {
                $data = [
                    'type' => 'direct',
                    'total' => $senderPrice->price6 ?? 0,
                    'service_fee' => $pickupZone->direct_srv_fees ?? 0
                ];
            }
        }

        if ($forceIndirect || $validated['from_city_id'] != $validated['to_city_id']) {

            $senderPrice = CityShipmentPrice::where('sender_sub_district_id', $pickupZone->sub_district_name)->first();
            $recieverPrice = CityShipmentPrice::where('receiver_sub_district_id', $dropOffZone->sub_district_name)->first();

            $priceField = match ($parcel->name) {
                Parcels::BAG_1->value => 'price1',
                Parcels::BAG_2->value => 'price2',
                Parcels::BAG_3->value => 'price3',
                Parcels::BAG_4->value => 'price4',
                Parcels::BAG_5->value => 'price5',
                default => 'price6',
            };

            $sender = $senderPrice->$priceField ?? 0;
            $receiver = $recieverPrice->$priceField ?? 0;

            $data = [
                'type' => 'indirect',

                'total' => $sender + $receiver,
                'sender_price' => $sender ?? 0,
                'reciever_price' => $receiver ?? 0,
                'service_fee' => ($pickupZone->direct_srv_fees + $dropOffZone->direct_srv_fees) ?? 0,

                'breakdown' => [
                    'sender' => $sender,
                    'receiver' => $receiver,
                    'formula' => "$sender + $receiver"
                ],

                'sender' => [
                    'zone' => $pickupZone->zone_name ?? null,
                    'subdistrict' => $pickupZone->sub_district_name ?? null,
                    'service_fee' => $pickupZone->direct_srv_fees ?? 0,
                    'price' => $sender,
                ],

                'receiver' => [
                    'zone' => $dropOffZone->zone_name ?? null,
                    'subdistrict' => $dropOffZone->sub_district_name ?? null,
                    'service_fee' => $dropOffZone->direct_srv_fees ?? 0,
                    'price' => $receiver,
                ],
            ];
        }
 
        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
