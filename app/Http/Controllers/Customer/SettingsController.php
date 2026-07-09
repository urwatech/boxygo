<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\City;
use App\Support\CustomerAccountSettings;
use App\Support\LegalPageContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class SettingsController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();

        // Fetch all cities from database
        $cities = City::select('id', 'name', 'name_arabic')
            ->orderBy('name')
            ->get()
            ->map(function ($city) {
                return [
                    'id' => $city->id,
                    'name' => $city->name,
                    'name_arabic' => $city->name_arabic,
                ];
            });

        return Inertia::render('Customer/Settings', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'phone_number' => $user->phone_number,
                'governorate' => $user->governorate,
                'address' => $user->address,
                'dob' => optional($user->dob)->toDateString(),
                'gender' => $user->gender,
                'avatar_url' => media_url($user->avatar_path),
            ],
            'cities' => $cities,
            'language' => $user->language ?? 'en',
            'notification' => [
                'email_notifications' => (bool) ($user->email_notifications ?? true),
                'push_notifications' => (bool) ($user->push_notifications ?? false),
            ],
            'deleteAccountEnabled' => CustomerAccountSettings::isDeleteAccountEnabled(),
            'termsContent' => LegalPageContent::terms($user->language ?? app()->getLocale()),
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        // Sanitize email aggressively to strip emojis and non-ASCII before validation
        $rawEmail = (string) $request->input('email', '');
        $sanitizedEmail = filter_var($rawEmail, FILTER_SANITIZE_EMAIL) ?? '';
        $sanitizedEmail = preg_replace('/[^\x20-\x7E]/', '', $sanitizedEmail); // remove non-ASCII
        $request->merge(['email' => trim($sanitizedEmail)]);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
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
            'address' => ['nullable', 'string', 'max:255'],
            'dob' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'max:20'],
            'avatar' => ['nullable', 'image', 'max:2048'],
        ]);

        if ($request->hasFile('avatar')) {
            $avatar = $request->file('avatar');

            if ($user->avatar_path) {
                delete_media_file($user->avatar_path);
            }

            $fileName = 'avatar_' . $user->id . '_' . time();
            $data['avatar_path'] = store_public_upload($avatar, 'customer-uploads', 'avatars', $fileName);
        }

        unset($data['avatar']);

        if (array_key_exists('dob', $data) && $data['dob'] === '') {
            $data['dob'] = null;
        }

        if (array_key_exists('gender', $data)) {
            $data['gender'] = $data['gender'] !== null ? trim($data['gender']) : null;
            if ($data['gender'] === '') {
                $data['gender'] = null;
            }
        }

        $user->fill($data);
        $user->save();

        return back()->with('success', __('profileUpdatedSuccessfully'));
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'string', 'confirmed'],
        ]);

        $user = $request->user();
        $user->password = bcrypt($data['password']);
        $user->save();

        return back()->with('success', __('passwordUpdatedSuccessfully'));
    }

    public function updateNotification(Request $request): RedirectResponse
    {
        // Validate presence, then coerce using Request::boolean() to avoid "false" string => true issue
        $request->validate([
            'email_notifications' => ['required'],
            'push_notifications' => ['required'],
        ]);

        $user = $request->user();
        $user->email_notifications = $request->boolean('email_notifications');
        $user->push_notifications = $request->boolean('push_notifications');

        if (!$user->push_notifications) {
            $user->fcm_token = null;
            $user->device_type = null;
        }

        $user->save();

        return back()->with('success', __('notificationPreferencesUpdated'));
    }

    public function storePushNotificationToken(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fcm_token' => ['required', 'string', 'max:4096'],
            'device_type' => ['nullable', 'string', 'max:50'],
        ]);

        $request->user()->forceFill([
            'fcm_token' => $data['fcm_token'],
            'device_type' => $data['device_type'] ?? 'web',
        ])->save();

        return response()->json([
            'message' => 'Push notification token saved.',
        ]);
    }

    public function destroyPushNotificationToken(Request $request): JsonResponse
    {
        $request->user()->forceFill([
            'fcm_token' => null,
            'device_type' => null,
        ])->save();

        return response()->json([
            'message' => 'Push notification token removed.',
        ]);
    }

    public function deleteAccount(Request $request): RedirectResponse|\Symfony\Component\HttpFoundation\Response
    {
        $user = $request->user();

        $user->forceFill([
            'fcm_token' => '',
            'device_type' => null,
            'is_deleted' => true,
            'phone_number' => null,
        ])->save();

        auth()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->header('X-Inertia')) {
            return Inertia::location(route('login'));
        }

        return redirect()->route('login');
    }

    public function updateLanguage(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'language' => ['required', 'string', 'in:en,ar'],
        ]);

        $user = $request->user();
        $user->language = $data['language'];
        $user->save();

        return back()->with('success', __('languageUpdatedSuccessfully'));
    }
}
