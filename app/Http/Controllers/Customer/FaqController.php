<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FaqController extends Controller
{
    /**
     * Display the FAQ page.
     *
     * @return Response
     */
    public function index(): Response
    {
        return Inertia::render('Customer/FAQ');
    }
}
