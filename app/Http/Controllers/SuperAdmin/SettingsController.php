<?php

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Support\CustomerAccountSettings;
use App\Support\FinancialSettings;
use App\Support\LegalPageContent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    /**
     * Display the settings page for the super admin.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();

        // Allow access if user has at least one settings permission.
        if (
            ! $user
            || (
                ! $user->can('settings.manage')
                && ! $user->can('settings.view')
                && ! $user->can('settings.profile')
                && ! $user->can('settings.password')
            )
        ) {
            abort(401);
        }

        return Inertia::render('SuperAdmin/Settings', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'governorate' => $user->governorate,
                'avatar_url' => media_url($user->avatar_path),
                'language' => $user->language ?? 'en',
            ],
            'financialSettings' => $this->getFinancialSettings(),
            'termsSettings' => LegalPageContent::termsForSettings(),
            'accountSettings' => [
                'delete_account_enabled' => CustomerAccountSettings::isDeleteAccountEnabled(),
            ],
            'permissions' => [
                'canUpdateProfile' => $user->can('settings.profile'),
                'canUpdatePassword' => $user->can('settings.password'),
            ],
            'language' => $user->language ?? 'en',
        ]);
    }

    /**
     * Update the profile information for the authenticated admin.
     */
    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('settings.profile')) {
            abort(401);
        }

        // Sanitize email aggressively to strip emojis and non-ASCII before validation
        $rawEmail = (string) $request->input('email', '');
        $sanitizedEmail = filter_var($rawEmail, FILTER_SANITIZE_EMAIL) ?? '';
        // Ensure any remaining non-ASCII characters are removed
        $sanitizedEmail = preg_replace('/[^\x20-\x7E]/', '', $sanitizedEmail);
        $request->merge([
            'email' => trim($sanitizedEmail),
        ]);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            // Reject anything that doesn't look like a plain ASCII email
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                'regex:/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/',
                'not_regex:/\bxn--/i',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'phone_number' => ['nullable', 'string', 'max:20', Rule::unique('users', 'phone_number')->ignore($user->id)],
            'governorate' => ['nullable', 'string', 'max:255'],
            'avatar' => ['nullable', 'image', 'max:2048'],
        ]);

        if ($request->hasFile('avatar')) {
            $avatar = $request->file('avatar');

            if ($user->avatar_path) {
                delete_media_file($user->avatar_path);
            }

            $fileName = 'avatar_'.$user->id.'_'.time();
            $data['avatar_path'] = store_public_upload($avatar, 'admin-settings', 'avatars', $fileName);
        }

        unset($data['avatar']);

        $user->fill($data);
        $user->save();

        return back()->with('success', __('profileUpdatedSuccessfully'));
    }

    /**
     * Update the password for the authenticated admin.
     */
    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user || ! $user->can('settings.password')) {
            abort(401);
        }

        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string'],
        ]);

        $user->password = $data['password'];
        $user->save();

        return back()->with('success', __('passwordUpdatedSuccessfully'));
    }

    /**
     * Update the financial settings for the authenticated admin.
     */
    public function updateFinancial(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (
            ! $user
            || (! $user->can('settings.profile') && ! $user->can('settings.financial'))
        ) {
            abort(401);
        }

        $data = $request->validate([
            'vat_type' => ['sometimes', 'required', 'string', Rule::in(['Fixed Amount', 'Percentage'])],
            'vat_value' => ['sometimes', 'nullable', 'string', 'max:50'],
            'platform_fee' => ['sometimes', 'nullable', 'string', 'max:50'],
            'door_service_fee' => ['sometimes', 'nullable', 'string', 'max:50'],
            'direct_service_fee' => ['sometimes', 'nullable', 'string', 'max:50'],
            'indirect_service_fee' => ['sometimes', 'nullable', 'string', 'max:50'],
            'insurance_type' => [
                'sometimes',
                'required',
                'string',
                Rule::in(['Percentage of declared value', 'Fixed Amount']),
            ],
            'insurance_value' => ['sometimes', 'nullable', 'string', 'max:50'],
            'insurance_compensation_value' => ['sometimes', 'nullable', 'string', 'max:50'],
            'insurance_min_amount' => ['sometimes', 'nullable', 'string', 'max:50'],
            'insurance_max_amount' => ['sometimes', 'nullable', 'string', 'max:50'],
            'delete_account_enabled' => ['sometimes', 'boolean'],
        ]);

        if (empty($data)) {
            return back();
        }

        $normalized = [];
        foreach ($data as $key => $value) {
            $normalized[$key] = is_string($value) ? trim($value) : $value;
        }

        $hasDeleteAccountToggle = array_key_exists('delete_account_enabled', $normalized);

        $allowedFields = array_keys(FinancialSettings::defaults());
        $payload = array_intersect_key($normalized, array_flip($allowedFields));

        if (empty($payload) && ! $hasDeleteAccountToggle) {
            return back();
        }

        if (! empty($payload)) {
            FinancialSettings::persist($payload);
        }

        if ($hasDeleteAccountToggle) {
            CustomerAccountSettings::persistDeleteAccountEnabled((bool) $normalized['delete_account_enabled']);
        }

        return back()->with('success', __('financialSettingsUpdatedSuccessfully'));
    }

    public function updateTerms(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (
            ! $user
            || (! $user->can('settings.profile') && ! $user->can('settings.manage'))
        ) {
            abort(401);
        }

        $data = $request->validate([
            'en.title' => ['nullable', 'string', 'max:255'],
            'en.body' => ['nullable', 'string'],
            'ar.title' => ['nullable', 'string', 'max:255'],
            'ar.body' => ['nullable', 'string'],
        ]);

        LegalPageContent::persistTerms([
            'en' => $data['en'] ?? [],
            'ar' => $data['ar'] ?? [],
        ]);

        return back()->with('success', __('termsSettingsUpdatedSuccessfully'));
    }

    public function updateLanguage(Request $request): RedirectResponse
    {
        $user = $request->user();

        if (! $user || (! $user->can('settings.profile') && ! $user->can('settings.password'))) {
            abort(401);
        }

        $data = $request->validate([
            'language' => ['required', 'string', Rule::in(['en', 'ar'])],
        ]);

        $user->language = $data['language'];
        $user->save();

        return back()->with('success', __('languageUpdatedSuccessfully'));
    }

    // private function getFinancialSettings(): array
    // {
    //     $defaults = $this->defaultFinancialSettings();
    //     $keys = array_keys($defaults);
    //     $prefixedKeys = array_map(fn ($key) => $this->financialKey($key), $keys);

    private function getFinancialSettings(): array
    {
        return FinancialSettings::get();
    }
}
