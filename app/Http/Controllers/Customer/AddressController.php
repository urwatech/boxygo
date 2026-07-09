<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\AddressServiceInterface;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AddressController extends Controller
{
    public function __construct(
        private readonly AddressServiceInterface $addressService
    ) {
    }

    /**
     * Display a listing of addresses.
     *
     * @param Request $request
     * @return Response
     */
    public function index(Request $request): Response
    {
        $addresses = $this->addressService->getUserAddresses($request->user()->id);

        return Inertia::render('Customer/Addresses', [
            'addresses' => $addresses,
        ]);
    }

    /**
     * Store a newly created address.
     *
     * @param Request $request
     * @return RedirectResponse
     */
    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateData($request);
        $this->addressService->createAddress($data, $request->user()->id);

        return redirect()->route('customer.addresses.index');
    }

    /**
     * Update the specified address.
     *
     * @param Request $request
     * @param string $address
     * @return RedirectResponse
     */
    public function update(Request $request, string $address): RedirectResponse
    {
        $data = $this->validateData($request);
        $this->addressService->updateAddress($address, $data, $request->user()->id);

        return redirect()->route('customer.addresses.index');
    }

    /**
     * Remove the specified address.
     *
     * @param Request $request
     * @param string $address
     * @return RedirectResponse
     */
    public function destroy(Request $request, string $address): RedirectResponse
    {
        $this->addressService->deleteAddress($address, $request->user()->id);

        return redirect()->route('customer.addresses.index');
    }

    /**
     * Validate address data.
     *
     * @param Request $request
     * @return array
     */
    private function validateData(Request $request): array
    {
        return $request->validate([
            'label' => 'nullable|string|in:Home,Work,Company,Handover,Delivery',
            'location_name' => 'required|string|max:255',
            'building_name' => 'nullable|string|max:255',
            'name' => 'nullable|string|max:255',
            'email' => 'nullable|string|max:255',
            'mobile' => 'nullable|string|max:255',
            'apartment' => 'nullable|string|max:255',
            'street' => 'required|string|max:255',
            'area' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'city_id' => 'nullable|exists:cities,id',
            'makaani_number' => 'nullable|string|max:255',
            'landmark' => 'nullable|string|max:255',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
        ]);
    }
}
