# Jobs API Documentation

This document describes the Jobs API endpoints for riders to manage their delivery jobs (shipments).

## Base URL
```
/api/v1/jobs
```

## Authentication
All endpoints require authentication using Laravel Sanctum. Include the bearer token in the request header:
```
Authorization: Bearer {token}
```

---

## Endpoints

### 1. GET /api/v1/jobs
Get a list of jobs assigned to the authenticated rider.

**Query Parameters:**
- `filter` (optional): Filter jobs by status
  - `assigned` (default): Show only active/ongoing jobs
  - `completed`: Show only delivered jobs
  - `all`: Show all jobs for the rider

**Example Request:**
```bash
GET /api/v1/jobs?filter=assigned
Authorization: Bearer {token}
```

**Example Response:**
```json
{
  "success": true,
  "data": [
      {
          "id": 12,
          "tracking_number": "SHIP-00000012",
          "delivery_speed": "indirect",
          "consignment_type": "package",
          "size": "small",
          "weight": "4.55",
          "schedule_time": "scheduled",
          "dimensions": {
              "length": null,
              "width": null,
              "height": null
          },
          "pickup": {
              "address": "551 Mathias Ranch, Damascus, Syria",
              "latitude": 33.488228,
              "longitude": 36.29445,
              "sender_name": "Zackery Hammes",
              "sender_phone": "+963979399416",
              "sender_landmark": "Opposite Hospital",
              "sender_building": "Building B, Floor 5"
          },
          "delivery": {
              "address": "320 Oran Ports, Damascus, Syria",
              "latitude": 33.531941,
              "longitude": 36.310618,
              "receiver_name": "Mr. Barry Schmidt V",
              "receiver_phone": "+963910837189",
              "receiver_landmark": "Next to Pharmacy",
              "receiver_building": "Building 3, Apt 18"
          },
          "dropoff_location": {
              "type": "drop_point_1",
              "label": "Drop Point 1",
              "address": "123 Drop Point Street, Damascus",
              "latitude": 33.512345,
              "longitude": 36.298765,
              "keeper_name": "Ahmed Keeper",
              "keeper_id": 15
          },
          "handover_user": {
              "id": 15,
              "name": "Ahmed Keeper",
              "role": "drop_point_keeper",
              "label": "Drop Point Keeper",
              "address": "123 Drop Point Street, Damascus",
              "latitude": 33.512345,
              "longitude": 36.298765
          },
          "pickup_from": "dp1",
          "payment": {
              "method": "cash",
              "status": "pending",
              "shipment_fee": 92.59,
              "shipment_subtotal": 92.59,
              "platform_fee": 5,
              "vat_rate": 0.05,
              "vat_amount": 4.63,
              "total_due": 102.22,
              "goods_amount": 4609.94,
              "goods_subtotal": 4609.94,
              "collectable_total": 4712.16,
              "total_fee": 4712.16,
              "parcel_amount": 4609.94
          },
          "status": "in_transit",
          "current_progress_index": null,
          "insurance": "No",
          "accept_returns": true,
          "special_instruction": null,
          "photos": [],
          "additional_docs": [],
          "customer": {
              "id": 24,
              "name": "Ms. Earlene Fay",
              "phone": null
          },
          "rider": {
              "id": 3,
              "name": "Main Driver",
              "phone": null
          },
          "created_at": "2025-10-26T06:16:34+00:00",
          "updated_at": "2025-10-28T14:25:10+00:00"
      }
  ],
  "meta": {
    "total": 5,
    "filter": "assigned"
  }
}
```

---

### 2. GET /api/v1/jobs/{id}
Get detailed information about a specific job.

**Parameters:**
- `id` (required): Job ID

**Example Request:**
```bash
GET /api/v1/jobs/1
Authorization: Bearer {token}
```

**Example Response:**
```json
{
    "success": true,
    "data": {
        "id": 8,
        "tracking_number": "SHIP-00000008",
        "delivery_speed": "direct",
        "consignment_type": "food",
        "size": "small",
        "weight": "4",
        "schedule_time": "scheduled",
        "dimensions": {
            "length": null,
            "width": null,
            "height": null
        },
        "pickup": {
            "address": "6454 Adaline Forge, Damascus, Syria",
            "latitude": 33.494153,
            "longitude": 36.337047,
            "sender_name": "Malvina Gulgowski",
            "sender_phone": "+963924843334",
            "sender_landmark": "Opposite Hospital",
            "sender_building": "Building C, Floor 10"
        },
        "delivery": {
            "address": "54260 Randall Fork Suite 724, Damascus, Syria",
            "latitude": 33.545516,
            "longitude": 36.32918,
            "receiver_name": "Brandt Pollich",
            "receiver_phone": "+963955634531",
            "receiver_landmark": "Near City Mall",
            "receiver_building": "Building 3, Apt 11"
        },
        "dropoff_location": {
            "type": "delivery",
            "label": "Delivery Address",
            "address": "54260 Randall Fork Suite 724, Damascus, Syria",
            "latitude": 33.545516,
            "longitude": 36.32918
        },
        "handover_user": null,
        "pickup_from": null,
        "payment": {
            "method": "online",
            "status": "pending",
            "shipment_fee": 8.76,
            "shipment_subtotal": 8.76,
            "platform_fee": 5,
            "vat_rate": 0.05,
            "vat_amount": 0.44,
            "total_due": 14.2,
            "goods_amount": 1496.87,
            "goods_subtotal": 1496.87,
            "collectable_total": 1511.07,
            "total_fee": 1511.07,
            "parcel_amount": 1496.87
        },
        "status": "assigned",
        "current_progress_index": null,
        "insurance": "Yes",
        "accept_returns": true,
        "special_instruction": "Culpa sed voluptas qui dolores.",
        "photos": [
            "photo1.jpg",
            "photo2.jpg"
        ],
        "additional_docs": [],
        "customer": {
            "id": 2,
            "name": "Customer User",
            "phone": null
        },
        "rider": {
            "id": 3,
            "name": "Main Driver",
            "phone": null
        },
        "review": null,
        "created_at": "2025-10-27T20:22:21+00:00",
        "updated_at": "2025-10-28T14:52:18+00:00"
    }
}
```

---

### 3. PUT /api/v1/jobs/{id}
Update the status of a job.

**Parameters:**
- `id` (required): Job ID

**Request Body:**
```json
{
  "status": "in_transit",
  "current_index": 2
}
```

**Available Status Values:**
- `pending`: Job created but not assigned
- `assigned`: Job assigned to rider
- `picked_up`: Parcel picked up from sender
- `in_transit`: On the way to destination
- `out_for_delivery`: Final delivery leg
- `delivered`: Successfully delivered
- `failed`: Delivery failed
- `returned`: Returned to sender
- `cancelled`: Job cancelled

**Optional Fields:**
- `current_index` (integer): Progress index for direct/indirect tracking

**Example Request:**
```bash
PUT /api/v1/jobs/1
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "delivered"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Job status updated successfully.",
  "data": {
    "id": 1,
    "tracking_number": "SHIP-00000001",
    "status": "delivered",
    "payment": {
      "method": "cash",
      "status": "paid",
      "shipment_fee": 50,
      "shipment_subtotal": 50,
      "platform_fee": 5,
      "vat_rate": 0.05,
      "vat_amount": 2.5,
      "total_due": 57.5,
      "goods_amount": 325,
      "goods_subtotal": 325,
      "collectable_total": 382.5,
      "total_fee": 382.5,
      "parcel_amount": 325.00
    }
  }
}
```

**Note:**
- When status is updated to `delivered` and payment method is `cash`, the payment status will remain `pending` until the rider collects the payment using the `/api/v1/jobs/collect/payment` endpoint.
- For online payments, the payment status is set when the payment gateway confirms the transaction.

---

### 4. POST /api/v1/jobs/collect/payment
Mark cash on delivery payment as collected after delivery.

**Important:** For COD shipments, the payment status remains 'pending' even after delivery until the rider calls this endpoint to confirm payment collection.

**Request Body:**
```json
{
  "shipment_id": 1
}
```

**Example Request:**
```bash
POST /api/v1/jobs/collect/payment
Authorization: Bearer {token}
Content-Type: application/json

{
  "shipment_id": 1
}
```

**Example Response:**
```json
{
    "success": true,
    "message": "Payment collected successfully.",
    "data": {
        "id": 11,
        "tracking_number": "SHIP-00000011",
        "delivery_speed": "indirect",
        "consignment_type": "documents",
        "size": "large",
        "weight": "18.84",
        "schedule_time": "scheduled",
        "dimensions": {
            "length": null,
            "width": null,
            "height": null
        },
        "pickup": {
            "address": "9361 Jenkins Fork Suite 222, Damascus, Syria",
            "latitude": 33.548261,
            "longitude": 36.338179,
            "sender_name": "Osborne Morar",
            "sender_phone": "+963991667787",
            "sender_landmark": "Near Central Bank",
            "sender_building": "Building A, Floor 9"
        },
        "delivery": {
            "address": "46784 Williamson Highway Suite 498, Damascus, Syria",
            "latitude": 33.482397,
            "longitude": 36.305258,
            "receiver_name": "Antone Skiles",
            "receiver_phone": "+963902097239",
            "receiver_landmark": "Opposite Mosque",
            "receiver_building": "Building 1, Apt 16"
        },
        "payment": {
            "method": "cash",
            "status": "paid",
            "shipment_fee": 24.35,
            "shipment_subtotal": 24.35,
            "platform_fee": 5,
            "vat_rate": 0.05,
            "vat_amount": 1.22,
            "total_due": 30.57,
            "goods_amount": 1909.89,
            "goods_subtotal": 1909.89,
            "collectable_total": 1940.46,
            "total_fee": 1940.46,
            "parcel_amount": 1909.89
        },
        "status": "in_transit",
        "current_progress_index": null,
        "insurance": "Yes",
        "accept_returns": false,
        "special_instruction": null,
        "photos": [],
        "additional_docs": [],
        "customer": {
            "id": 23,
            "name": "Mr. Emmanuel Green",
            "phone": null
        },
        "rider": {
            "id": 3,
            "name": "Main Driver",
            "phone": null
        },
        "review": null,
        "created_at": "2025-10-24T12:40:58+00:00",
        "updated_at": "2025-10-28T15:26:49+00:00"
    }
}
```

**Error Response (Already Collected):**
```json
{
  "success": false,
  "message": "Payment has already been collected for this shipment."
}
```

**Error Response (Not COD):**
```json
{
  "success": false,
  "message": "This shipment is not a cash on delivery order."
}
```

**Error Response (Not Delivered Yet):**
```json
{
  "success": false,
  "message": "Payment can only be collected after the shipment has been delivered."
}
```

---

### 5. POST /api/v1/jobs/scan-parcel
Scan and accept a parcel (assign shipment to rider).

**Request Body:**
```json
{
  "shipment_id": 1
}
```

**Example Request:**
```bash
POST /api/v1/jobs
Authorization: Bearer {token}
Content-Type: application/json

{
  "shipment_id": 1
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Parcel scanned and assigned successfully.",
  "data": {
    "id": 1,
    "tracking_number": "SHIP-00000001",
    "status": "picked_up",
    "rider": {
      "id": 5,
      "name": "Ahmed Ali",
      "phone": "+963555123456"
    }
  }
}
```

**Error Response (Already Assigned):**
```json
{
  "success": false,
  "message": "This parcel is already assigned to another rider."
}
```

**Note:**
- If the shipment is in `pending` status, it will be updated to `picked_up` automatically.
- The shipment will be assigned to the authenticated rider.

---

## Indirect Delivery Fields

For indirect deliveries, the API provides additional fields to help riders, car drivers, and drop point keepers navigate the multi-leg delivery process.

### dropoff_location

The next destination where the parcel should be delivered. This changes dynamically based on the current status.

| Type | Label | Description |
|------|-------|-------------|
| `drop_point_1` | Drop Point 1 | Nearest drop point to pickup location |
| `warehouse` | Warehouse | Central warehouse |
| `drop_point_2` | Drop Point 2 | Nearest drop point to delivery location |
| `delivery` | Delivery Address | Final delivery address |

**Structure:**
```json
{
  "type": "drop_point_1",
  "label": "Drop Point 1",
  "address": "123 Street, City",
  "latitude": 33.512345,
  "longitude": 36.298765,
  "keeper_name": "Ahmed",  // Only for drop points
  "keeper_id": 15          // Only for drop points
}
```

**Status to Dropoff Mapping (Indirect Delivery):**
| Current Status | Dropoff Location |
|----------------|------------------|
| Pending, Assigned, Pickup, Picked up | Drop Point 1 |
| Arrived at Drop Point 1, Delivered to Drop Point 1, Dispatched to Warehouse | Warehouse |
| Arrived at Warehouse, Dispatched from Warehouse | Drop Point 2 |
| Arrived at Drop Point 2, Ready for Pickup, Picked up by Receiver, Dispatched from Drop Point 2, Pickup from Drop Point 2, In Transit to Customer, Delivered | Final Delivery Address |

---

### handover_user

The person who should hand over the parcel to the current actor. This is useful for car drivers and drop point keepers to know who to expect the parcel from.

**Structure:**
```json
{
  "id": 15,
  "name": "Ahmed Keeper",
  "role": "drop_point_keeper",  // or "warehouse_keeper"
  "label": "Drop Point Keeper",
  "address": "123 Street, City",
  "latitude": 33.512345,
  "longitude": 36.298765
}
```

**Status to Handover User Mapping:**
| Current Status | Handover User |
|----------------|---------------|
| Dispatched to Warehouse | Drop Point Keeper 1 |
| Dispatched from Warehouse | Warehouse Keeper |
| Ready for Pickup | Drop Point Keeper 2 |
| Dispatched from Drop Point 2 | Drop Point Keeper 2 |
| Pickup from Drop Point 2 | Drop Point Keeper 2 |

---

### pickup_from

For car drivers, this field indicates where to pick up the parcel. Used to display the correct timeline in the mobile app.

| Value | Description |
|-------|-------------|
| `dp1` | Pick up from Drop Point 1 (first leg: DP1 → Warehouse) |
| `warehouse` | Pick up from Warehouse (second leg: Warehouse → DP2) |
| `dp2` | Parcel is at Drop Point 2 |
| `null` | Not applicable (for riders or direct delivery) |

**Status to pickup_from Mapping:**
| Current Status | pickup_from |
|----------------|-------------|
| Dispatched to Warehouse, In Transit (first leg) | `dp1` |
| Arrived at Warehouse | `warehouse` |
| Dispatched from Warehouse | `warehouse` |
| Arrived at Drop Point 2, Ready for Pickup, Dispatched from Drop Point 2, Pickup from Drop Point 2 | `dp2` |

---

## Error Responses

All endpoints may return the following error responses:

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthenticated."
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "This action is unauthorized."
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Job not found."
}
```

**422 Validation Error:**
```json
{
  "success": false,
  "message": "The given data was invalid.",
  "errors": {
    "status": ["Invalid status value."]
  }
}
```

---

## Job Status Flow

Typical job status progression:

1. `pending` → Job created by customer
2. `assigned` → Admin assigns job to rider
3. `picked_up` → Rider scans and picks up parcel
4. `in_transit` → Rider is on the way
5. `out_for_delivery` → Final delivery leg
6. `delivered` → Successfully delivered

Alternative flows:
- `failed` → Delivery attempt failed
- `returned` → Returned to sender
- `cancelled` → Job cancelled

---

## Testing with Postman/cURL

### Example cURL Commands:

**Get assigned jobs:**
```bash
curl -X GET "http://localhost:8000/api/v1/jobs?filter=assigned" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"
```

**Update job status:**
```bash
curl -X PUT "http://localhost:8000/api/v1/jobs/1" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"status":"in_transit"}'
```

**Collect payment:**
```bash
curl -X POST "http://localhost:8000/api/v1/jobs/collect/payment" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"shipment_id":1}'
```

**Scan parcel:**
```bash
curl -X POST "http://localhost:8000/api/v1/jobs" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"shipment_id":1}'
```
