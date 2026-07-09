<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'sendgrid' => [
        'api_key' => env('SENDGRID_API_KEY'),
        'templates' => [
            'verification_code' => env('SENDGRID_VERIFICATION_TEMPLATE_ID'),
            'password_reset' => env('SENDGRID_PASSWORD_RESET_TEMPLATE_ID'),
            'employee_invitation' => env('SENDGRID_EMPLOYEE_INVITATION_TEMPLATE_ID'),
            'welcome_user' => env('SENDGRID_WELCOME_USER_TEMPLATE_ID'),
            'shipment_verification' => env('SENDGRID_SHIPMENT_VERIFICATION_TEMPLATE_ID'),
        ],
    ],

    'google' => [
        'maps_api_key' => env('GOOGLE_MAPS_API_KEY'),
        'places_api_key' => env('GOOGLE_PLACES_API_KEY'),
    ],

    'firebase' => [
        'web' => [
            'apiKey' => env('VITE_FIREBASE_API_KEY'),
            'authDomain' => env('VITE_FIREBASE_AUTH_DOMAIN'),
            'projectId' => env('VITE_FIREBASE_PROJECT_ID'),
            'storageBucket' => env('VITE_FIREBASE_STORAGE_BUCKET'),
            'messagingSenderId' => env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
            'appId' => env('VITE_FIREBASE_APP_ID'),
        ],
        'vapid_key' => env('VITE_FIREBASE_VAPID_KEY'),
    ],

    'mtn_sms' => [
        'base_url' => env('MTN_SMS_BASE_URL'),
        'secret' => env('MTN_SMS_SECRET'),
        'email' => env('MTN_SMS_EMAIL'),
        'password' => env('MTN_SMS_PASSWORD'),
    ],

    'mtn_payment' => [
        'base_url' => env('MTN_PAYMENT_BASE_URL'),
        'secret' => env('MTN_PAYMENT_SECRET'),
        'email' => env('MTN_PAYMENT_EMAIL'),
        'password' => env('MTN_PAYMENT_PASSWORD'),
    ],

    'assatex' => [
        'url' => env('ASSATEX_API_URL'),
        'key' => env('ASSATEX_API_KEY'),
    ],

];
