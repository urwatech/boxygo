<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\ShipmentRepositoryInterface;
use App\Http\Controllers\Controller;
use App\Models\Address;
use App\Models\Parcel;
use App\Support\FinancialSettings;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BookingController extends Controller
{
    public function __construct(
        private readonly ShipmentRepositoryInterface $shipmentRepository
    ) {}

    /**
     * Show the create booking form.
     */
    public function create(Request $request): Response
    {
        $payload = array_filter(
            $request->only([
                'handover_address',
                'handover_latitude',
                'handover_longitude',
                'handover_city',
                'handover_state',
                'handover_landmark',
                'handover_building',
                'handover_source',
                'handover_is_drop_point',
                'handover_drop_point_id',
                'handover_drop_point_name',
                'handover_name',
                'handover_email',
                'handover_mobile',
                'sender_name',
                'sender_email',
                'sender_phone',
                'isHandoverLocationDP',
                'delivery_address',
                'delivery_latitude',
                'delivery_longitude',
                'delivery_city',
                'delivery_state',
                'delivery_landmark',
                'delivery_building',
                'delivery_source',
                'delivery_is_drop_point',
                'delivery_drop_point_id',
                'delivery_drop_point_name',
                'delivery_name',
                'delivery_email',
                'delivery_mobile',
                'receiver_name',
                'receiver_email',
                'receiver_phone',
                'isDeliveryLocationDP',
            ]),
            fn ($v) => ! is_null($v)
        );

        // Provide active parcel sizes to make size selection dynamic
        $sizes = Parcel::query()
            ->where('status', Parcel::STATUS_ACTIVE)
            ->orderBy('name')
            ->get()
            ->map(function (Parcel $p) {
                $icon = media_url($p->icon_path);

                return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'min_weight_kg' => $p->min_weight_kg,
                    'max_weight_kg' => $p->max_weight_kg,
                    'icon_path' => $icon,
                ];
            });

        // Get latest booking to prefill sender and receiver details
        $latestBooking = null;
        if ($request->user()) {
            $latestShipment = $this->shipmentRepository->getLatestUserShipment($request->user()->id);
            if ($latestShipment) {
                $latestBooking = [
                    'sender_name' => $latestShipment->sender_name,
                    'sender_phone' => $latestShipment->sender_phone,
                    'sender_email' => $latestShipment->sender_email,
                    'sender_landmark' => $latestShipment->sender_landmark,
                    'sender_building' => $latestShipment->sender_building,
                    'receiver_name' => $latestShipment->receiver_name,
                    'receiver_phone' => $latestShipment->receiver_phone,
                    'receiver_email' => $latestShipment->receiver_email,
                    'receiver_landmark' => $latestShipment->receiver_landmark,
                    'receiver_building' => $latestShipment->receiver_building,
                ];
            }
        }

        // Get user's saved landmarks from addresses
        $savedLandmarks = [];
        if ($request->user()) {
            $savedLandmarks = Address::where('user_id', $request->user()->id)
                ->whereNotNull('landmark')
                ->where('landmark', '!=', '')
                ->pluck('landmark')
                ->unique()
                ->values()
                ->toArray();
        }

        // Get user's saved building names from addresses
        $savedBuildings = [];
        if ($request->user()) {
            $savedBuildings = Address::where('user_id', $request->user()->id)
                ->whereNotNull('building_name')
                ->where('building_name', '!=', '')
                ->pluck('building_name')
                ->unique()
                ->values()
                ->toArray();
        }

        // Get user's saved landmarks from addresses
        $savedNames = [];
        if ($request->user()) {
            $savedNames = Address::where('user_id', $request->user()->id)
                ->whereNotNull('name')
                ->where('name', '!=', '')
                ->pluck('name')
                ->unique()
                ->values()
                ->toArray();
        }

        // Get user's saved building names from addresses
        $savedEmails = [];
        if ($request->user()) {
            $savedEmails = Address::where('user_id', $request->user()->id)
                ->whereNotNull('email')
                ->where('email', '!=', '')
                ->pluck('email')
                ->unique()
                ->values()
                ->toArray();
        }

        // Get user's saved landmarks from addresses
        $savedMobiles = [];
        if ($request->user()) {
            $savedMobiles = Address::where('user_id', $request->user()->id)
                ->whereNotNull('mobile')
                ->where('mobile', '!=', '')
                ->pluck('mobile')
                ->unique()
                ->values()
                ->toArray();
        }

        return Inertia::render('Customer/CreateBooking', array_merge($payload, [
            'sizes' => $sizes,
            'latestBooking' => $latestBooking,
            'savedLandmarks' => $savedLandmarks,
            'savedBuildings' => $savedBuildings,
            'savedNames' => $savedNames,
            'savedEmails' => $savedEmails,
            'savedMobiles' => $savedMobiles,
            'financialSettings' => $this->getFinancialSettings(),
        ]));
    }

    private function getFinancialSettings(): array
    {
        return FinancialSettings::get();
    }
}
