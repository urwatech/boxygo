# API Reference

This document describes the publicly available REST endpoints that power the MarcelPro mobile and web clients. All endpoints are served from the `/api/v1` namespace unless stated otherwise.

## Conventions

- **Base URL:** `https://<your-domain>/api/v1`
- **Content Type:** JSON unless noted. File uploads use `multipart/form-data`.
- **Authentication:** Bearer tokens issued by the authentication endpoints (Laravel Sanctum). Include the header `Authorization: Bearer <access_token>` for protected endpoints.
- **Timestamps:** ISO 8601 strings (e.g., `2024-04-05T12:30:00Z`).
- **Pagination:** Not currently used by the existing endpoints.

## Authentication & User Lifecycle

### Register a New User

`POST /auth/register`

Creates a pending user and issues a one-time password (OTP) token for verification.

**Headers**
- `Content-Type: application/json`

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | Yes | Full name (max 255 chars) |
| `email` | string | Yes | RFC-compliant email, must be unique |
| `password` | string | Yes | Minimum 8 chars, must include upper/lowercase, numbers, and symbols |
| `password_confirmation` | string | Yes | Must match `password` |
| `phone_number` | string | Yes | Digits with optional `+`, 10-15 characters, unique |
| `role` | string | Yes | Must be either "rider" or "drop point keeper" |

**Success (201)**
```json
{
  "message": "Registration successful. Please verify the one-time password sent to you.",
  "data": {
    "user": { /* See User object */ },
    "verification_token": "otp-token-id",
    "expires_at": "2024-04-05T12:30:00Z",
    "debug": { "otp_code": "123456" }
  }
}
```
> The `debug` block is only returned when `APP_DEBUG=true`.

### Verify OTP

`POST /auth/verify-otp`

Validates the OTP code, activates the user, and issues an access token.

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `verification_token` | string | Yes | Token returned during registration or resend |
| `code` | string | Yes | 6-digit OTP |

**Success (200)**
```json
{
  "success": true,
  "message": "Verification successful.",
  "data": {
    "user": { /* See User object */ },
    "token": {
      "access_token": "<token>",
      "token_type": "Bearer",
      "expires_at": null
    }
  }
}
```

**Error Responses**
- `422 Unprocessable Entity` when the token or code is invalid.
- `410 Gone` when the OTP has expired.

### Resend OTP

`POST /auth/resend-otp`

Issues a new OTP for an existing but unverified user.

**Body Parameters** (provide one of)
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `verification_token` | string | Conditional | Token from previous OTP issuance |
| `email` | string | Conditional | User email address |

**Success (200)**
```json
{
  "success": true,
  "message": "A new verification code has been sent.",
  "data": {
    "verification_token": "otp-token-id",
    "expires_at": "2024-04-05T12:35:00Z",
    "debug": { "otp_code": "654321" }
  }
}
```

**Error Responses**
- `404 Not Found` when the user does not exist.
- `400 Bad Request` if the account is already verified.

### Login

`POST /auth/login`

Authenticates an active user and returns an access token.

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | Yes | Registered email | or
| `phone_number` |  | Yes | Registered phone | 
| `password` | string | Yes | Plain-text password |

**Success (200)**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": { /* See User object */ },
    "token": {
      "access_token": "<token>",
      "token_type": "Bearer",
      "expires_at": null
    }
  }
}
```

**Error Responses**
- `422 Unprocessable Entity` when credentials are incorrect.
- `403 Forbidden` if the account is not yet active.

### Request Password Reset Link

`POST /auth/forgot-password`

Sends a password reset email with a one-time token.

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `email` | string | Yes | Registered email address |

**Success (200)**
```json
{
  "success": true,
  "message": "We have emailed your password reset link!"
}
```

**Error Responses**
- `422 Unprocessable Entity` if the email does not match a user or the request is throttled.

### Reset Password

`POST /auth/reset-password`

Resets the user's password using the token from the password reset email.

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `token` | string | Yes | Token delivered via the reset email |
| `email` | string | Yes | Registered email address |
| `password` | string | Yes | Minimum 8 chars with upper/lowercase, numbers, and symbols |
| `password_confirmation` | string | Yes | Must match `password` |

**Success (200)**
```json
{
  "success": true,
  "message": "Your password has been reset!"
}
```

**Error Responses**
- `422 Unprocessable Entity` when the token is invalid, expired, or the passwords do not match the validation rules.

### Logout

`DELETE /auth/logout`

Revokes the current access token.

**Headers**
- `Authorization: Bearer <access_token>`

**Success (204)** - empty response body.

### Fetch Authenticated User

`GET /auth/me`

Retrieves details for the currently authenticated user.

**Headers**
- `Authorization: Bearer <access_token>`

**Success (200)**
```json
{
  "success": true,
  "message": "Authenticated user fetched successfully.",
  "data": {
    "id": 42,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "status": "active",
    "email_verified_at": "2024-04-05T12:30:00Z",
    "phone_verified_at": "2024-04-05T12:31:00Z",
    "created_at": "2024-04-05T12:00:00Z"
  }
}
```

## User Profile Management

### Update User Profile

`PUT /user/profile`

Updates the authenticated user's basic profile information.

**Headers**
- `Authorization: Bearer <access_token>`
- `Content-Type: multipart/form-data`

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | No | Full name (max 255 chars) |
| `email` | string | No | RFC-compliant email, must be unique |
| `phone_number` | string | No | Must be unique (max 20 chars) |
| `avatar` | file | No | Profile avatar image (JPEG, JPG, PNG; max 2MB) |
| `governorate` | string | No | User's governorate/region (max 255 chars) |
| `dob` | date | No | Date of birth (must be in the past) |
| `gender` | string | No | Must be: male, female, or other |
| `email_notifications` | boolean | No | Enable/disable email notifications |
| `push_notifications` | boolean | No | Enable/disable push notifications |

**Success (200)**
```json
{
  "success": true,
  "message": "Profile updated successfully.",
  "data": {
    "id": 42,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "avatar_url": "https://<your-domain>/storage/avatars/jane123.jpg",
    "governorate": "Cairo",
    "dob": "1990-05-15",
    "gender": "female",
    "email_notifications": true,
    "push_notifications": true,
    "status": "active",
    "created_at": "2024-04-05T12:00:00Z"
  }
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.
- `422 Unprocessable Entity` for validation failures (e.g., duplicate email, invalid image format).

### Get User Documents

`GET /user/documents`

Retrieves all uploaded documents for the authenticated user.

**Headers**
- `Authorization: Bearer <access_token>`

**Success (200)**
```json
{
  "success": true,
  "message": "Documents fetched successfully.",
  "data": {
    "driving_license": {
      "uploaded": true,
      "url": "https://<your-domain>/storage/documents/license123.jpg",
      "filename": "license123.jpg"
    },
    "id_card_front": {
      "uploaded": true,
      "url": "https://<your-domain>/storage/documents/id_front123.jpg",
      "filename": "id_front123.jpg"
    },
    "id_card_back": {
      "uploaded": true,
      "url": "https://<your-domain>/storage/documents/id_back123.jpg",
      "filename": "id_back123.jpg"
    },
    "passport": {
      "uploaded": false,
      "url": null,
      "filename": null
    },
    "idp": {
      "uploaded": false,
      "url": null,
      "filename": null
    }
  }
}
```

**Response Fields**
| Field | Type | Description |
| --- | --- | --- |
| `uploaded` | boolean | Whether the document has been uploaded |
| `url` | string/null | Full URL to access the document (null if not uploaded) |
| `filename` | string/null | Original filename (null if not uploaded) |

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.

**Notes**
- Returns status of all document types
- URLs can be used to download or display documents
- If a document is not uploaded, `uploaded` will be false and `url`/`filename` will be null

### Update User Documents

`POST /user/documents`

Uploads or updates user documents (driving license, ID cards, passport, IDP). Driving license and ID cards are required, while passport and IDP are optional.

**Headers**
- `Authorization: Bearer <access_token>`
- `Content-Type: multipart/form-data`

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `driving_license` | file | Yes | Driving license document (PDF, JPEG, JPG, PNG; max 5MB) |
| `id_card_front` | file | Yes | ID card front image (PDF, JPEG, JPG, PNG; max 5MB) |
| `id_card_back` | file | Yes | ID card back image (PDF, JPEG, JPG, PNG; max 5MB) |
| `passport` | file | No | Passport document (PDF, JPEG, JPG, PNG; max 5MB) |
| `idp` | file | No | International Driving Permit (PDF, JPEG, JPG, PNG; max 5MB) |

**Success (200)**
```json
{
  "success": true,
  "message": "Documents updated successfully.",
  "data": {
    "id": 42,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "driving_license_url": "https://<your-domain>/storage/documents/license123.jpg",
    "id_card_front_url": "https://<your-domain>/storage/documents/id_front123.jpg",
    "id_card_back_url": "https://<your-domain>/storage/documents/id_back123.jpg",
    "passport_url": "https://<your-domain>/storage/documents/passport123.pdf",
    "idp_url": "https://<your-domain>/storage/documents/idp123.jpg",
    "created_at": "2024-04-05T12:00:00Z"
  }
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.
- `422 Unprocessable Entity` for validation failures (e.g., missing required document, invalid file format, file too large).

**Notes**
- Only driving license, ID card front, and ID card back are required
- Passport and IDP are optional
- Previous documents are automatically deleted when new ones are uploaded
- Accepted formats: PDF, JPEG, JPG, PNG
- Maximum file size: 5MB per document

### Update Profile Picture

`POST /user/profile-picture`

Uploads or updates the user's profile picture.

**Headers**
- `Authorization: Bearer <access_token>`
- `Content-Type: multipart/form-data`

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `profile_picture` | file | Yes | Profile picture image (JPEG, JPG, PNG; max 2MB) |

**Success (200)**
```json
{
  "success": true,
  "message": "Profile picture updated successfully.",
  "data": {
    "id": 42,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "avatar_url": "https://<your-domain>/storage/profile_pictures/jane456.jpg",
    "created_at": "2024-04-05T12:00:00Z"
  }
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.
- `422 Unprocessable Entity` for validation failures (e.g., missing file, invalid image format, file too large).

**Notes**
- Previous profile picture is automatically deleted when a new one is uploaded
- Accepted formats: JPEG, JPG, PNG
- Maximum file size: 2MB

### Get Rider Earnings

`GET /user/earnings`

Retrieves earnings summary and COD shipments for the authenticated rider.

**Headers**
- `Authorization: Bearer <access_token>`

**Success (200)**
```json
{
  "success": true,
  "data": {
    "todays_deliveries": 80,
    "total_amount": 12800,
    "cash_collected": 6000,
    "prepaid_shipment": 6800,
    "cod_shipments": [
      {
        "ship_id": "MP1450001",
        "amount": 121,
        "pickup_address": "12 Al-Midan St, near Al-Shuhada Park, Aleppo",
        "delivery_address": "Al-Farabi St, near St Elias Church, Aleppo",
        "shipment_type": "Direct/DD",
        "status": "pending_handover"
      },
      {
        "ship_id": "MP1450111",
        "amount": 80,
        "pickup_address": "12 Al-Midan St, near Al-Shuhada Park, Aleppo",
        "delivery_address": "Al-Farabi St, near St Elias Church, Aleppo",
        "shipment_type": "Regular",
        "status": "settled"
      }
    ]
  }
}
```

**Response Fields**
| Field | Type | Description |
| --- | --- | --- |
| `todays_deliveries` | integer | Number of deliveries completed today |
| `total_amount` | integer | Total delivery fees earned (in SYP) |
| `cash_collected` | integer | Total cash collected from COD orders (in SYP) |
| `prepaid_shipment` | integer | Total from online/prepaid orders (in SYP) |
| `cod_shipments` | array | List of COD shipments with their details |

**COD Shipment Status Values**
- `pending` - Shipment not yet delivered
- `pending_collection` - Delivered but cash not collected
- `pending_handover` - Cash collected, waiting for handover to admin
- `settled` - Cash handed over to admin

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.

**Notes**
- Only riders can access this endpoint
- Shows up to 20 recent COD shipments
- Amounts are in SYP (Syrian Pound)

### Deposit Cash to Admin

`POST /user/deposit-cash`

Allows rider to mark cash as deposited with admin. This notifies the system that the rider has handed over the collected COD cash to admin and is waiting for admin confirmation.

**Headers**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `shipment_id` | integer | Yes | ID of the shipment for which cash was deposited |
| `notes` | string | No | Optional notes about the deposit (max 500 chars) |

**Success (200)**
```json
{
  "success": true,
  "message": "Cash deposit request submitted successfully.",
  "data": {
    "shipment_id": 15,
    "ship_id": "MP0000015",
    "amount": 121,
    "status": "pending_admin_confirmation",
    "message": "Cash deposit marked. Waiting for admin confirmation."
  }
}
```

**Error Responses**
- `400 Bad Request` if:
  - Rider has not collected payment from customer yet
  - Cash has already been deposited with admin
- `404 Not Found` if shipment not found or not assigned to rider
- `401 Unauthorized` when the access token is missing or invalid
- `422 Unprocessable Entity` for validation failures

**Notes**
- Rider must have collected cash from customer first (via `/jobs/collect/payment`)
- This endpoint marks the rider's intent to deposit
- Admin must confirm the deposit on their end (via COD Management)
- Once confirmed by admin, the settlement is complete

**Flow:**
1. Rider delivers shipment
2. Rider collects cash from customer → `POST /jobs/collect/payment`
3. Rider deposits cash with admin → `POST /user/deposit-cash`
4. Admin confirms receipt → `PATCH /admin/cod-management/{id}/collect`

## Vehicle Management

### List Vehicles

`GET /vehicles`

Returns the vehicles that belong to the authenticated user. Requires authentication.

**Headers**
- `Authorization: Bearer <access_token>`

**Success (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "code": "VHC-07",
      "type": "Sedan",
      "make": "Toyota",
      "model": "Camry",
      "color": "Blue",
      "license_plate": "ABC123",
      "status": "active",
      "permit_expires_at": null,
      "insurance_expires_at": null,
      "photo_url": "https://<your-domain>/storage/vehicle-photos/abc123.jpg",
      "assigned_rider": null,
      "created_at": "2024-04-05T12:45:00Z"
    }
  ]
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.

### Register Vehicle

`POST /vehicles`

Associates a vehicle with the authenticated user. Requires authentication.

**Headers**
- `Authorization: Bearer <access_token>`
- `Content-Type: multipart/form-data`

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | string | Yes | Vehicle type/category (max 100 chars) |
| `make` | string | No | Manufacturer (max 100 chars) |
| `model` | string | No | Model name (max 100 chars) |
| `color` | string | No | Exterior color (max 50 chars) |
| `license_plate` | string | Yes | Uppercased automatically; must be unique |
| `photo` | file | No | Image (max 5 MB), stored under `vehicle-photos/` |

**Success (201)**
```json
{
  "success": true,
  "message": "Vehicle registered successfully.",
  "data": {
    "id": 7,
    "code": "VHC-07",
    "type": "Sedan",
    "make": "Toyota",
    "model": "Camry",
    "color": "Blue",
    "license_plate": "ABC123",
    "status": "pending",
    "permit_expires_at": null,
    "insurance_expires_at": null,
    "photo_url": "https://<your-domain>/storage/vehicle-photos/abc123.jpg",
    "assigned_rider": null,
    "created_at": "2024-04-05T12:45:00Z"
  }
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.
- `422 Unprocessable Entity` for validation failures (e.g., duplicate license plate, invalid image).

## Shelf Management

**Role Restriction:** All shelf management endpoints are restricted to users with the **"drop point keeper"** role only.

### List Shelves

`GET /shelves`

Retrieves available shelves, optionally filtered by location. Requires authentication and drop point keeper role.

**Headers**
- `Authorization: Bearer <access_token>`

**Query Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `location` | string | No | Filter shelves by location |

**Success (200)**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "SHL-001",
      "location": "Warehouse A",
      "capacity": 50,
      "occupied_slots": 23,
      "available_capacity": 27,
      "is_active": true,
      "created_at": "2024-04-01T10:00:00Z",
      "updated_at": "2024-04-05T14:30:00Z"
    },
    {
      "id": 2,
      "code": "SHL-002",
      "location": "Warehouse A",
      "capacity": 40,
      "occupied_slots": 40,
      "available_capacity": 0,
      "is_active": true,
      "created_at": "2024-04-01T10:05:00Z",
      "updated_at": "2024-04-05T16:20:00Z"
    }
  ]
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.
- `403 Forbidden` when the authenticated user does not have the "drop point keeper" role.

### Assign Shelf to Shipment

`POST /shelves/assign`

Assigns a specific shelf to a shipment for storage. Requires authentication and drop point keeper role.

**Headers**
- `Authorization: Bearer <access_token>`
- `Content-Type: application/json`

**Body Parameters**
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `shelf_id` | integer | Yes | ID of the shelf to assign |
| `shipment_id` | integer | Yes | ID of the shipment to be stored |

**Success (200)**
```json
{
  "success": true,
  "message": "Shelf assigned successfully.",
  "data": {
    "shipment_id": 123,
    "shelf": {
      "id": 1,
      "code": "SHL-001",
      "location": "Warehouse A",
      "capacity": 50,
      "occupied_slots": 24,
      "available_capacity": 26,
      "is_active": true,
      "created_at": "2024-04-01T10:00:00Z",
      "updated_at": "2024-04-05T14:30:00Z"
    },
    "shelf_assigned_at": "2024-04-05T15:45:00Z"
  }
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.
- `403 Forbidden` when the authenticated user does not have the "drop point keeper" role.
- `400 Bad Request` when the shelf has insufficient capacity or other business logic errors (e.g., shelf is inactive).
- `404 Not Found` when the shelf or shipment does not exist.
- `422 Unprocessable Entity` for validation failures (e.g., invalid shelf_id or shipment_id format).
- `500 Internal Server Error` for unexpected errors during assignment.

### Shelf Usage

Shelves are used to organize and track storage locations for shipments in the warehouse:
- Each shelf has a unique `code` identifier and a physical `location`
- Shelves have a fixed `capacity` representing the maximum number of items they can hold
- `occupied_slots` tracks how many slots are currently in use
- `available_capacity` is automatically calculated as `capacity - occupied_slots`
- Only active shelves (`is_active: true`) can be assigned to new shipments
- When a shelf is assigned to a shipment, the `occupied_slots` count is incremented
- Shelves can be filtered by location to help warehouse staff find appropriate storage

## Data Shapes

### User Object

```json
{
  "id": 10,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone_number": "+15551234567",
  "status": "active",
  "email_verified_at": "2024-04-05T12:30:00Z",
  "phone_verified_at": "2024-04-05T12:31:00Z",
  "created_at": "2024-04-05T12:00:00Z"
}
```

### Vehicle Object

```json
{
  "id": 7,
  "code": "VHC-07",
  "type": "Sedan",
  "make": "Toyota",
  "model": "Camry",
  "color": "Blue",
  "license_plate": "ABC123",
  "status": "pending",
  "permit_expires_at": null,
  "insurance_expires_at": null,
  "photo_url": "https://<your-domain>/storage/vehicle-photos/abc123.jpg",
  "assigned_rider": {
    "id": 10,
    "name": "Jane Doe",
    "email": "jane@example.com"
  },
  "created_at": "2024-04-05T12:45:00Z"
}
```
> `assigned_rider` is only present when the relationship is loaded; otherwise, it will be `null`.

### Shelf Object

```json
{
  "id": 1,
  "code": "SHL-001",
  "location": "Warehouse A",
  "capacity": 50,
  "occupied_slots": 23,
  "available_capacity": 27,
  "is_active": true,
  "created_at": "2024-04-01T10:00:00Z",
  "updated_at": "2024-04-05T14:30:00Z"
}
```
> `available_capacity` is a computed attribute calculated as `capacity - occupied_slots`.

## Notifications

### Get User Notifications

`GET /notifications`

Retrieves all notifications for the authenticated user, grouped by date with human-readable labels.

**Headers**
- `Authorization: Bearer <access_token>`

**Query Parameters**
| Parameter | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `limit` | integer | No | 50 | Maximum number of notifications to return |
| `unread_only` | boolean | No | false | If true, only return unread notifications |
| `before_date` | string | No | null | Return notifications before this date (Format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS) |
| `after_date` | string | No | null | Return notifications after this date (Format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS) |

**Success (200)**
```json
{
  "success": true,
  "data": {
    "notifications": {
      "Today": [
        {
          "id": "9d9e8f7e-...",
          "type": "App\\Notifications\\DeliveryAssignedNotification",
          "title": "New Delivery Assigned",
          "message": "You have been assigned shipment #SHIP-001",
          "data": {
            "shipment_id": "SHIP-001",
            "tracking_number": "TRK-123456"
          },
          "read_at": null,
          "created_at": "2025-10-31T14:30:00Z"
        }
      ],
      "Yesterday": [
        {
          "id": "8c8d7e6d-...",
          "type": "App\\Notifications\\DeliveryCompletedNotification",
          "title": "Delivery Completed",
          "message": "Shipment #SHIP-002 has been delivered",
          "data": {
            "shipment_id": "SHIP-002",
            "tracking_number": "TRK-123457"
          },
          "read_at": "2025-10-31T10:00:00Z",
          "created_at": "2025-10-30T16:45:00Z"
        }
      ],
      "October 29, 2025": [
        {
          "id": "7b7c6d5c-...",
          "type": "App\\Notifications\\EarningsUpdateNotification",
          "title": "Earnings Update",
          "message": "Your recent earnings: $1,500.00",
          "data": {
            "amount": 1500.00,
            "period": "recent"
          },
          "read_at": "2025-10-29T18:00:00Z",
          "created_at": "2025-10-29T12:00:00Z"
        }
      ]
    },
    "meta": {
      "total": 42,
      "unread": 5,
      "shown": 15,
      "filters": {
        "limit": 50,
        "unread_only": false,
        "before_date": null,
        "after_date": null
      }
    }
  }
}
```

**Response Fields**
| Field | Type | Description |
| --- | --- | --- |
| `notifications` | object | Notifications grouped by date label (Today, Yesterday, or formatted date) |
| `meta.total` | integer | Total number of notifications |
| `meta.unread` | integer | Number of unread notifications |
| `meta.shown` | integer | Number of notifications returned in this response |

**Date Grouping:**
- **"Today"** - Notifications from today
- **"Yesterday"** - Notifications from yesterday
- **"Month Day, Year"** - Formatted date for older notifications (e.g., "October 29, 2025")

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.

**Notes**
- Notifications are ordered by most recent first within each group
- Groups are ordered chronologically (Today → Yesterday → older dates)
- The `read_at` field is null for unread notifications
- The `filters` object in `meta` shows the applied filters for reference

**Filter Examples:**

1. **Get only unread notifications:**
   ```
   GET /notifications?unread_only=true
   ```

2. **Get notifications before a specific date:**
   ```
   GET /notifications?before_date=2025-10-01
   ```

3. **Get notifications after a specific date and time:**
   ```
   GET /notifications?after_date=2025-10-01 12:00:00
   ```

4. **Get last 10 unread notifications before a date:**
   ```
   GET /notifications?limit=10&unread_only=true&before_date=2025-10-15
   ```

5. **Get notifications in a date range:**
   ```
   GET /notifications?after_date=2025-10-01&before_date=2025-10-31
   ```

6. **Pagination - load more (infinite scroll):**
   ```
   GET /notifications?limit=20&before_date=2025-10-29
   ```
   (Use the oldest notification's created_at from previous response as before_date)

### Mark Notification as Read

`PUT /notifications/{id}/read`

Marks a specific notification as read.

**Headers**
- `Authorization: Bearer <access_token>`

**URL Parameters**
| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | Yes | Notification UUID |

**Success (200)**
```json
{
  "success": true,
  "message": "Notification marked as read.",
  "data": {
    "id": "9d9e8f7e-...",
    "type": "App\\Notifications\\DeliveryAssignedNotification",
    "title": "New Delivery Assigned",
    "message": "You have been assigned shipment #SHIP-001",
    "read_at": "2025-10-31T15:00:00Z",
    "created_at": "2025-10-31T14:30:00Z"
  }
}
```

**Error Responses**
- `404 Not Found` if notification not found or doesn't belong to user
- `401 Unauthorized` when the access token is missing or invalid.

### Mark All Notifications as Read

`POST /notifications/read-all`

Marks all unread notifications as read for the authenticated user.

**Headers**
- `Authorization: Bearer <access_token>`

**Success (200)**
```json
{
  "success": true,
  "message": "All notifications marked as read."
}
```

**Error Responses**
- `401 Unauthorized` when the access token is missing or invalid.

### Delete Notification

`DELETE /notifications/{id}`

Deletes a specific notification.

**Headers**
- `Authorization: Bearer <access_token>`

**URL Parameters**
| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | Yes | Notification UUID |

**Success (200)**
```json
{
  "success": true,
  "message": "Notification deleted successfully."
}
```

**Error Responses**
- `404 Not Found` if notification not found or doesn't belong to user
- `401 Unauthorized` when the access token is missing or invalid.

## Error Format

All error responses use the same JSON envelope:

```json
{
  "message": "Human readable description",
  "errors": { /* optional validation details */ }
}
```

Laravel will automatically include a field-level `errors` object for validation failures.

## Testing Tips

- OTP codes are only included in responses when `APP_DEBUG` is enabled. In production, read the code from the delivery channel configured by `OtpService` (e.g., SMS, email).
- Access tokens do not currently expire automatically; revoke them via `/auth/logout` or Laravel Sanctum tools.
- Uploaded vehicle photos are stored on the `public` disk; ensure `php artisan storage:link` has been executed for local development.

