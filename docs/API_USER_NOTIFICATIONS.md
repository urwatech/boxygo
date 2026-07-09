# User Profile & Notifications API Documentation

This document describes the User Profile and Notifications API endpoints.

## Base URL
```
/api/v1
```

## Authentication
All endpoints require authentication using Laravel Sanctum. Include the bearer token in the request header:
```
Authorization: Bearer {token}
```

---

## User Profile Endpoints

### 1. PUT /api/v1/user/profile
Update the authenticated user's profile.

**Request Body (multipart/form-data or JSON):**
All fields are optional. Only include fields you want to update.

```json
{
  "name": "Ahmed Ali",
  "email": "ahmed.ali@example.com",
  "phone_number": "+963555123456",
  "governorate": "Damascus",
  "dob": "1990-05-15",
  "gender": "male",
  "email_notifications": true,
  "push_notifications": true
}
```

**For avatar upload, use multipart/form-data:**
```
POST /api/v1/user/profile
Content-Type: multipart/form-data

name: Ahmed Ali
avatar: [file upload]
email_notifications: true
```

**Available Fields:**
- `name` (string, max 255): User's full name
- `email` (email, unique): Email address
- `phone_number` (string, max 20, unique): Phone number
- `avatar` (image file, max 2MB): Profile picture (JPEG, JPG, PNG)
- `governorate` (string): User's governorate/region
- `dob` (date, YYYY-MM-DD): Date of birth
- `gender` (enum): `male`, `female`, or `other`
- `email_notifications` (boolean): Enable/disable email notifications
- `push_notifications` (boolean): Enable/disable push notifications

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/v1/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "name": "Ahmed Ali",
    "governorate": "Damascus",
    "email_notifications": true
  }'
```

**Example Response:**
```json
{
  "message": "Profile updated successfully.",
  "data": {
    "id": 5,
    "name": "Ahmed Ali",
    "email": "ahmed.ali@example.com",
    "phone_number": "+963555123456",
    "status": "active",
    "employee_id": "EMP001",
    "user_type": "rider",
    "governorate": "Damascus",
    "dob": "1990-05-15",
    "gender": "male",
    "avatar_url": "http://localhost:8000/storage/avatars/abc123.jpg",
    "shipment_type": "bike",
    "employment_type": "full_time",
    "license_expiry": "2026-12-31",
    "completed_jobs": 150,
    "cancel_rate": 2.5,
    "avg_eta_minutes": 25,
    "cod_collection_limit": 5000.00,
    "working_hours": {
      "monday": "09:00-17:00",
      "tuesday": "09:00-17:00"
    },
    "email_notifications": true,
    "push_notifications": true,
    "email_verified_at": "2025-10-01T10:00:00Z",
    "phone_verified_at": "2025-10-01T10:05:00Z",
    "member_since": "2025-10-01T09:00:00Z",
    "created_at": "2025-10-01T09:00:00Z",
    "updated_at": "2025-10-28T14:30:00Z"
  }
}
```

**Validation Errors (422):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["This email is already taken."],
    "avatar": ["Avatar size cannot exceed 2MB."],
    "dob": ["Date of birth must be in the past."]
  }
}
```

---

## Notification Endpoints

### 2. GET /api/v1/notifications
Get all notifications for the authenticated user.

**Query Parameters:**
- `limit` (optional, default: 50): Maximum number of notifications to return
- `unread_only` (optional, boolean): If true, only return unread notifications

**Example Request:**
```bash
GET /api/v1/notifications?limit=20&unread_only=false
Authorization: Bearer {token}
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "App\\Notifications\\DeliveryAssignedNotification",
      "title": "New Delivery Assigned",
      "content": "You have been assigned a new delivery. Tap to view details and start the trip.",
      "notification_type": "delivery",
      "icon": "delivery_icon",
      "data": {
        "title": "New Delivery Assigned",
        "content": "You have been assigned a new delivery. Tap to view details and start the trip.",
        "notification_type": "delivery",
        "icon": "delivery_icon",
        "shipment_id": "SHIP-001",
        "tracking_number": "TRK-123456"
      },
      "read_at": null,
      "is_read": false,
      "created_at": "2025-10-28T14:30:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "type": "App\\Notifications\\EarningsUpdateNotification",
      "title": "Earnings Update",
      "content": "You earned $1500.00 for your recent delivery from Oct 28.",
      "notification_type": "earnings",
      "icon": "dollar_circle",
      "data": {
        "title": "Earnings Update",
        "content": "You earned $1500.00 for your recent delivery from Oct 28.",
        "notification_type": "earnings",
        "icon": "dollar_circle",
        "amount": 1500.00,
        "period": "recent"
      },
      "read_at": "2025-10-28T15:00:00Z",
      "is_read": true,
      "created_at": "2025-10-28T14:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "unread": 12,
    "shown": 20
  }
}
```

**Response Fields:**
- `id` (UUID): Unique notification identifier
- `type` (string): Notification class name
- `title` (string): Notification title/heading
- `content` (string): Notification content/description
- `notification_type` (string): Category of notification (e.g., 'delivery', 'earnings', 'account')
- `icon` (string): Icon name or image URL for the notification
- `data` (object): Additional notification data including all fields above plus custom data
- `read_at` (timestamp|null): When the notification was read (null if unread)
- `is_read` (boolean): Whether the notification has been read
- `created_at` (timestamp): When the notification was created

---

### 3. PUT /api/v1/notifications/{id}/read
Mark a specific notification as read.

**Parameters:**
- `id` (required): Notification UUID

**Example Request:**
```bash
PUT /api/v1/notifications/550e8400-e29b-41d4-a716-446655440000/read
Authorization: Bearer {token}
```

**Example Response:**
```json
{
  "message": "Notification marked as read.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "App\\Notifications\\DeliveryAssignedNotification",
    "title": "New Delivery Assigned",
    "content": "You have been assigned a new delivery. Tap to view details and start the trip.",
    "notification_type": "delivery",
    "icon": "delivery_icon",
    "data": {
      "title": "New Delivery Assigned",
      "content": "You have been assigned a new delivery. Tap to view details and start the trip.",
      "notification_type": "delivery",
      "icon": "delivery_icon",
      "shipment_id": "SHIP-001",
      "tracking_number": "TRK-123456"
    },
    "read_at": "2025-10-28T15:30:00Z",
    "is_read": true,
    "created_at": "2025-10-28T14:30:00Z"
  }
}
```

---

### 4. POST /api/v1/notifications/read-all
Mark all notifications as read for the authenticated user.

**Example Request:**
```bash
POST /api/v1/notifications/read-all
Authorization: Bearer {token}
```

**Example Response:**
```json
{
  "message": "All notifications marked as read."
}
```

---

### 5. DELETE /api/v1/notifications/{id}
Delete a specific notification.

**Parameters:**
- `id` (required): Notification UUID

**Example Request:**
```bash
DELETE /api/v1/notifications/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {token}
```

**Example Response:**
```json
{
  "message": "Notification deleted successfully."
}
```

---

## Error Responses

All endpoints may return the following error responses:

**401 Unauthorized:**
```json
{
  "message": "Unauthenticated."
}
```

**404 Not Found:**
```json
{
  "message": "Notification not found."
}
```

**422 Validation Error:**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": ["This email is already taken."]
  }
}
```

---

## Testing with cURL

### Update Profile:
```bash
curl -X PUT "http://localhost:8000/api/v1/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ahmed Ali",
    "governorate": "Damascus",
    "push_notifications": true
  }'
```

### Update Profile with Avatar:
```bash
curl -X POST "http://localhost:8000/api/v1/user/profile" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "name=Ahmed Ali" \
  -F "avatar=@/path/to/image.jpg" \
  -F "email_notifications=true"
```

### Get Notifications:
```bash
curl -X GET "http://localhost:8000/api/v1/notifications?limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

### Get Only Unread Notifications:
```bash
curl -X GET "http://localhost:8000/api/v1/notifications?unread_only=true" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

### Mark Notification as Read:
```bash
curl -X PUT "http://localhost:8000/api/v1/notifications/550e8400-e29b-41d4-a716-446655440000/read" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

### Mark All as Read:
```bash
curl -X POST "http://localhost:8000/api/v1/notifications/read-all" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

### Delete Notification:
```bash
curl -X DELETE "http://localhost:8000/api/v1/notifications/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

---

## Migration Instructions

Before using the notifications feature, run the migration:

```bash
php artisan migrate
```

This will create the `notifications` table required for storing user notifications.

---

## Creating Custom Notifications

To send notifications to users, create a notification class:

```bash
php artisan make:notification DeliveryAssignedNotification
```

Example notification with the new fields (title, content, notification_type, icon):

```php
<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DeliveryAssignedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $shipmentId,
        public readonly string $trackingNumber,
        public readonly ?string $assignedBy = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'New Delivery Assigned',
            'content' => 'You have been assigned a new delivery. Tap to view details and start the trip.',
            'notification_type' => 'delivery',
            'icon' => $this->assignedBy ? "avatar_{$this->assignedBy}" : 'delivery_icon',
            'shipment_id' => $this->shipmentId,
            'tracking_number' => $this->trackingNumber,
        ];
    }

    public function toDatabase(object $notifiable): array
    {
        return $this->toArray($notifiable);
    }
}
```

**Required Fields for Notifications:**
- `title` (string): The notification title/heading
- `content` (string): The notification description/message
- `notification_type` (string): Category of the notification (e.g., 'delivery', 'earnings', 'account')
- `icon` (string): Icon name or image URL for the notification

**Additional Custom Fields:**
You can include any additional data fields specific to your notification type (e.g., `shipment_id`, `tracking_number`, `amount`, etc.)

Send notification to user:

```php
$user->notify(new DeliveryAssignedNotification(
    shipmentId: 'SHIP-001',
    trackingNumber: 'TRK-123456',
    assignedBy: $admin->id
));
```

**Available Notification Types:**
- `delivery`: Delivery-related notifications (assignments, completions, updates)
- `earnings`: Payment and earnings notifications
- `account`: Account-related notifications (profile updates, verifications)
- `system`: System-wide announcements and updates
