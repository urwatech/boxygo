<?php

namespace App\Http\Controllers\Customer;

use App\Contracts\CustomerAuthServiceInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\Auth\RegisterRequest;
use App\Http\Requests\Customer\Auth\ResendVerificationRequest;
use App\Http\Requests\Customer\Auth\VerifyCodeRequest;
use App\Models\Shipment;
use App\Services\WalletService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RegisterController extends Controller
{
    public function __construct(private readonly CustomerAuthServiceInterface $authService, private readonly WalletService $walletService) {}

    public function create(): Response
    {
        return Inertia::render('Customer/Auth/Register');
    }

    public function store(RegisterRequest $request): RedirectResponse
    {
        $user = $this->authService->registerCustomer($request->validated());
        if($request->shipmentId){
            $shipment = Shipment::where('order_number', $request->shipmentId)->first();
 
            if($shipment && $shipment->receiver_id == null){
                $shipment->receiver_id = $user->id;
                $shipment->save();
            }
        }

        $this->walletService->getOrCreateWallet($user->id);

        if ($request->shipmentId) {
            $shipment = Shipment::where('order_number', $request->shipmentId)->where('receiver_email', $user->email)->first();

            if ($shipment && $shipment->receiver_id == null) {
                $shipment->receiver_id = $user->id;
                $shipment->save();
            }
        }

        return redirect()->route('customer.verify.show', ['email' => $user->email]);
    }

    public function showVerify(Request $request): Response
    {
        $email = $request->query('email');
        return Inertia::render('Customer/Auth/Verify', [
            'email' => $email,
        ]);
    }

    public function verify(VerifyCodeRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $this->authService->verifyEmailCode($data['email'], $data['code']);

        return redirect()
            ->route('login')
            ->with('success', __('accountVerifiedWeHaveSuccessfullyVerifiedYourAccountPleaseLoginToContinue'));
    }

    public function resend(ResendVerificationRequest $request): RedirectResponse
    {
        $data = $request->validated();

        $this->authService->resendVerificationCode($data['email']);

        return back()->with('success', __('verificationCodeResent'));
    }
}
