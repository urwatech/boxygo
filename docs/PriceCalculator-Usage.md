# PriceCalculator Service - Usage Guide

## Overview

The `PriceCalculator` service calculates shipment prices between two locations based on governorate and city type. It implements the same business logic as the company's Excel pricing matrix.

**Service Location:** `app/Services/PriceCalculator.php`
**Configuration:** `config/pricing.php`

---

## Business Rules

The service applies the following pricing rules:

1. **Base Charge (Always Applied)**: `inside_city` = 9,000
2. **Different Governorate**: Add `different_gov` = 12,000
3. **Different City Types** (M ↔ CS): Add `m_cs` = 6,000
4. **Both Countryside + Different Gov**: Add `cs` = 11,000

### City Types

- **M**: Main City
- **CS**: Countryside

---

## Basic Usage

### 1. Simple Price Calculation

```php
use App\Services\PriceCalculator;

$calculator = new PriceCalculator();

// Calculate price from Damascus (M) to Daraa (M)
$price = $calculator->calculate(
    fromGov: 'DAM',
    fromType: 'M',
    toGov: 'DAR',
    toType: 'M'
);

// Result: 21,000 (inside_city: 9,000 + different_gov: 12,000)
```

### 2. Using Governorate IDs

```php
// You can use governorate IDs instead of short codes
$price = $calculator->calculate(
    fromGov: 1,      // Damascus ID
    fromType: 'M',
    toGov: 2,        // Daraa ID
    toType: 'CS'
);

// Result: 27,000 (inside_city + different_gov + m_cs)
```

### 3. Calculate with Detailed Breakdown

```php
$result = $calculator->calculateWithBreakdown(
    fromGov: 'DAM',
    fromType: 'CS',
    toGov: 'DAR',
    toType: 'CS'
);

// Returns:
// [
//     'total' => 32000,
//     'breakdown' => [
//         ['label' => 'Base Charge (Inside City)', 'amount' => 9000, 'applied' => true],
//         ['label' => 'Different Governorate', 'amount' => 12000, 'applied' => true],
//         ['label' => 'Main City to Countryside', 'amount' => 6000, 'applied' => false],
//         ['label' => 'Both Countryside (Different Gov)', 'amount' => 11000, 'applied' => true],
//     ],
//     'from' => ['governorate' => 'DAM', 'type' => 'CS', 'type_label' => 'Countryside'],
//     'to' => ['governorate' => 'DAR', 'type' => 'CS', 'type_label' => 'Countryside'],
// ]
```

---

## Integration Examples

### In a Controller

```php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PriceCalculator;
use Illuminate\Http\Request;

class ShipmentPriceController extends Controller
{
    public function __construct(
        private PriceCalculator $calculator
    ) {}

    public function calculate(Request $request)
    {
        $validated = $request->validate([
            'from_governorate' => 'required',
            'from_type' => 'required|in:M,CS',
            'to_governorate' => 'required',
            'to_type' => 'required|in:M,CS',
        ]);

        try {
            $result = $this->calculator->calculateWithBreakdown(
                fromGov: $validated['from_governorate'],
                fromType: $validated['from_type'],
                toGov: $validated['to_governorate'],
                toType: $validated['to_type']
            );

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 400);
        }
    }
}
```

### Using with City Models

```php
use App\Models\City;
use App\Services\PriceCalculator;

// Get cities from database
$fromCity = City::with('governate')->find(1);
$toCity = City::with('governate')->find(2);

$calculator = new PriceCalculator();

$price = $calculator->calculate(
    fromGov: $fromCity->governate->short_code,
    fromType: $fromCity->type,
    toGov: $toCity->governate->short_code,
    toType: $toCity->type
);
```

### In Shipment Creation

```php
use App\Models\Shipment;
use App\Services\PriceCalculator;

public function createShipment(array $data): Shipment
{
    $calculator = new PriceCalculator();

    // Calculate shipping price
    $shippingFee = $calculator->calculate(
        fromGov: $data['sender_governorate'],
        fromType: $data['sender_city_type'],
        toGov: $data['receiver_governorate'],
        toType: $data['receiver_city_type']
    );

    $shipment = Shipment::create([
        // ... other shipment data
        'shipping_fee' => $shippingFee,
        'total_fee' => $shippingFee + $data['parcel_amount'],
    ]);

    return $shipment;
}
```

---

## Pricing Scenarios

### Scenario 1: Same Governorate, Same Type
```php
// Damascus (M) → Damascus (M)
$price = $calculator->calculate('DAM', 'M', 'DAM', 'M');
// Result: 9,000 (base charge only)
```

### Scenario 2: Same Governorate, Different Types
```php
// Damascus (M) → Damascus Countryside (CS)
$price = $calculator->calculate('DAM', 'M', 'DAM', 'CS');
// Result: 15,000 (base: 9,000 + m_cs: 6,000)
```

### Scenario 3: Different Governorates, Same Type
```php
// Damascus (M) → Daraa (M)
$price = $calculator->calculate('DAM', 'M', 'DAR', 'M');
// Result: 21,000 (base: 9,000 + different_gov: 12,000)
```

### Scenario 4: Different Governorates, Different Types
```php
// Damascus (M) → Daraa Countryside (CS)
$price = $calculator->calculate('DAM', 'M', 'DAR', 'CS');
// Result: 27,000 (base: 9,000 + different_gov: 12,000 + m_cs: 6,000)
```

### Scenario 5: Both Countryside, Different Governorates
```php
// Damascus Countryside (CS) → Daraa Countryside (CS)
$price = $calculator->calculate('DAM', 'CS', 'DAR', 'CS');
// Result: 32,000 (base: 9,000 + different_gov: 12,000 + cs: 11,000)
```

---

## Configuration

Pricing values are stored in `config/pricing.php`:

```php
return [
    'different_gov' => 12000,  // Different governorate charge
    'm_cs' => 6000,            // Main city ↔ Countryside charge
    'inside_city' => 9000,     // Base charge (always applied)
    'cs' => 11000,             // Both countryside charge
];
```

### Updating Prices

To update pricing:

1. Edit `config/pricing.php`
2. Clear config cache: `php artisan config:clear`
3. No code changes needed - service automatically uses new values

---

## Error Handling

The service validates inputs and throws `InvalidArgumentException` for:

- Invalid city types (must be 'M' or 'CS')
- Missing configuration values
- Invalid configuration values (non-numeric)

```php
try {
    $price = $calculator->calculate('DAM', 'INVALID', 'DAR', 'M');
} catch (\InvalidArgumentException $e) {
    // Handle error: "Invalid city type 'INVALID' for parameter 'fromType'"
}
```

---

## Database Schema

### Cities Table Migration

The service requires a `type` field on the `cities` table:

```php
// Migration: 2025_11_11_075506_add_type_to_cities_table.php
Schema::table('cities', function (Blueprint $table) {
    $table->enum('type', ['M', 'CS'])->default('M')->after('governate_id');
});
```

**Run migration:**
```bash
php artisan migrate
```

### City Model

```php
// app/Models/City.php
protected $fillable = [
    'governate_id',
    'type',           // M or CS
    'name',
    'short_code',
    'name_arabic',
];
```

---

## Testing

Comprehensive tests are available in `tests/Unit/Services/PriceCalculatorTest.php`

**Run tests:**
```bash
php artisan test --filter=PriceCalculatorTest
```

**Test coverage:**
- All pricing scenarios (14 test cases)
- Breakdown functionality
- Error handling
- Integer/string governorate IDs
- Configuration validation

---

## API Example

Create an API endpoint for price calculation:

**Route:**
```php
Route::post('shipments/calculate-price', [ShipmentPriceController::class, 'calculate']);
```

**Request:**
```json
{
  "from_governorate": "DAM",
  "from_type": "M",
  "to_governorate": "DAR",
  "to_type": "CS"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 27000,
    "breakdown": [
      {"label": "Base Charge (Inside City)", "amount": 9000, "applied": true},
      {"label": "Different Governorate", "amount": 12000, "applied": true},
      {"label": "Main City to Countryside", "amount": 6000, "applied": true},
      {"label": "Both Countryside", "amount": 11000, "applied": false}
    ],
    "from": {
      "governorate": "DAM",
      "type": "M",
      "type_label": "Main City"
    },
    "to": {
      "governorate": "DAR",
      "type": "CS",
      "type_label": "Countryside"
    }
  }
}
```

---

## Best Practices

1. **Dependency Injection**: Inject the service in controllers
2. **Error Handling**: Always wrap in try-catch blocks
3. **Caching**: Consider caching calculated prices for common routes
4. **Logging**: Log price calculations for audit trails
5. **Validation**: Validate inputs before calling the service

---

## Support

For questions or issues, please open an issue on the project repository.
