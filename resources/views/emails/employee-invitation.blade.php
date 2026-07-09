@component('mail::message')
# Welcome to {{ config('app.name') }}!

Hello **{{ $employee->name }}**,

We're excited to have you join the {{ config('app.name') }} team! Your account has been created successfully.

@if($employee->roles->isNotEmpty())
You have been assigned the role of **{{ $employee->roles->first()->name }}**.
@endif

## Your Login Credentials

Below are your credentials to access the system:

@component('mail::panel')
**Email Address:** {{ $employee->email }}

**Temporary Password:** `{{ $password }}`

@if($employee->employee_id)
**Employee ID:** {{ $employee->employee_id }}
@endif
@endcomponent

@component('mail::button', ['url' => $loginUrl, 'color' => 'primary'])
Login to Your Account
@endcomponent

{{-- @component('mail::promotion')
**Security Notice:** For your security, please change your password after your first login. Keep your credentials confidential and do not share them with anyone.
@endcomponent --}}

> **Security Notice:** For your security, please change your password after your first login. Keep your credentials confidential and do not share them with anyone.

If you have any questions or need assistance, please don't hesitate to contact your administrator.

Best regards,
**The {{ config('app.name') }} Team**

@endcomponent
