<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Support\LegalPageContent;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TermsController extends Controller
{
    /**
     * Display the Terms and Conditions page.
     */
    public function index(Request $request): Response
    {
        $locale = $request->user()?->language ?? app()->getLocale();

        return Inertia::render('Customer/TermsAndConditions', [
            'termsContent' => LegalPageContent::terms($locale),
        ]);
    }
}
