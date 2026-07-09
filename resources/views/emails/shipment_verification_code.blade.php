@component('mail::message')
# Shipment Delivery Verification Code

@if($receiverName)
Hello {{ $receiverName }},
@else
Hello,
@endif

A shipment (ID: **#{{ $shipmentId }}**) is on its way to you!

When the rider arrives to deliver your parcel, they will ask you for this verification code:

@component('mail::panel')
<div style="text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb;">
{{ $verificationCode }}
</div>
@endcomponent

**Important:** The rider will request this code upon delivery to confirm they are delivering to the correct recipient.

<small style="color: #6b7280;">Please keep this code secure and only share it with the authorized rider when they arrive.</small>

Thanks,<br>
{{ config('app.name') }}
@endcomponent
