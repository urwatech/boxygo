<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;

class HomeController extends Controller
{
    /**
     * Redirect to the customer login page.
     */
    public function index(): RedirectResponse
    {
        return redirect()->route('login');
    }
}
