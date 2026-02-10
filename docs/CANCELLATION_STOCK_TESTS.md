# Order Cancellation Stock Restoration Tests

Comprehensive integration tests to ensure food quantities are properly restored when orders are cancelled by users or admins.

## Overview

These tests verify the critical inventory management feature: when an order is cancelled, the food items' stock quantities must be accurately restored to prevent inventory discrepancies.

## Test Coverage

### Backend Tests (`tests/test_order_cancellation_stock.py`)

**User Cancellation Tests:**
- ✅ TC-CANCEL-STOCK-01: User cancels order → quantity restored
- ✅ TC-CANCEL-STOCK-02: Admin deletes order → quantity restored
- ✅ TC-CANCEL-STOCK-03: Multi-item order → all quantities restored
- ✅ TC-CANCEL-STOCK-04: Cancel after 2-min window → fails, stock unchanged
- ✅ TC-CANCEL-STOCK-05: Double cancel → stock not restored twice
- ✅ TC-CANCEL-STOCK-06: Cancel confirmed order → fails
- ✅ TC-CANCEL-STOCK-07: Unavailable food becomes available again
- ✅ TC-CANCEL-STOCK-08: Concurrent cancellations safe
- ✅ TC-CANCEL-STOCK-09: Different user cannot cancel
- ✅ TC-CANCEL-STOCK-10: Full workflow integration

**Admin Cancellation Tests:**
- ✅ Admin can delete any order and restore stock
- ✅ Admin can delete old orders (>2min) and restore stock

### Frontend Tests (`frontend/tests/integration/order-cancellation-stock.test.ts`)

**User Cancellation Tests:**
- ✅ User cancel → stock restored
- ✅ Multi-item order → all stocks restored
- ✅ Cancel after window → fails without restoring
- ✅ Double cancel prevention
- ✅ Unavailable food becomes available

**Admin Cancellation Tests:**
- ✅ Admin delete user order → stock restored
- ✅ Admin delete multi-item order → all stocks restored

**Complete Workflow:**
- ✅ Order → Verify decrease → Cancel → Verify restore → Check status

**Error Cases:**
- ✅ User cannot cancel another user's order
- ✅ Cannot cancel non-pending orders

## Business Logic

### Order Cancellation Window

**User Cancellation:**
- ✅ Only within 2 minutes of order creation
- ✅ Only by the user who created the order
- ✅ Only for orders with status "pending"

**Admin Cancellation:**
- ✅ No time restriction
- ✅ Can delete any order
- ✅ Can delete orders in any status

### Stock Restoration Logic

When an order is cancelled:

```python
# For each item in the order
for item in order.items:
    food = get_food(item.food_id)
    food.stock_quantity += item.quantity  # Restore
    food.is_available = True              # Re-enable if was disabled
```

**Safety Features:**
1. Uses `with_for_update()` for row-level locking
2. Prevents concurrent cancellation issues
3. Validates order status before restoration
4. Ensures idempotent operations

## Running Tests

### Backend Tests

```bash
# Run all order cancellation tests
uv run pytest tests/test_order_cancellation_stock.py -v

# Run specific test
uv run pytest tests/test_order_cancellation_stock.py::TestOrderCancellationStockRestoration::test_tc_cancel_stock_01_user_cancel_restores_quantity -v

# Run with output
uv run pytest tests/test_order_cancellation_stock.py -v -s

# Run admin tests only
uv run pytest tests/test_order_cancellation_stock.py::TestAdminCancellationStockRestoration -v
```

### Frontend Tests

```bash
cd frontend

# Run all order cancellation tests
npm test -- order-cancellation-stock.test.ts

# Run specific test suite
npm test -- order-cancellation-stock.test.ts -t "User Cancellation Tests"

# Run with verbose output
npm test -- order-cancellation-stock.test.ts --verbose

# Run admin tests only
npm test -- order-cancellation-stock.test.ts -t "Admin Cancellation Tests"
```

## Prerequisites

### Backend Tests
1. Database with test schema
2. Pytest fixtures (auto-loaded from `conftest.py`)

### Frontend Tests
1. **Backend running:**
   ```bash
   uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Admin user exists:**
   ```bash
   uv run python scripts/create_admin.py
   ```

3. **Database seeded:**
   ```bash
   uv run python scripts/seed_data.py
   ```

## Test Scenarios

### Scenario 1: Basic User Cancellation

```
1. Initial stock: 50 units
2. User orders 5 units → Stock: 45
3. User cancels within 2 min
4. Expected: Stock restored to 50
```

### Scenario 2: Multi-Item Order

```
1. Food A: 100 units, Food B: 80 units
2. Order: 10x A, 5x B → A: 90, B: 75
3. Cancel order
4. Expected: A: 100, B: 80
```

### Scenario 3: Admin Override

```
1. User creates order 3 hours ago (confirmed)
2. Stock already decreased
3. Admin deletes order (no time limit)
4. Expected: Stock restored
```

### Scenario 4: Double Cancel Prevention

```
1. User cancels order → Stock restored
2. User tries to cancel again → Error 400
3. Expected: Stock not restored twice
```

### Scenario 5: Unavailable Food Recovery

```
1. Food has 5 units in stock
2. User orders all 5 → Stock: 0, is_available: false
3. User cancels
4. Expected: Stock: 5, is_available: true
```

## API Endpoints Tested

### User Cancellation
```http
POST /api/v1/orders/{order_id}/cancel
Authorization: Bearer {user_token}
```

**Success Response (200):**
```json
{
  "id": 123,
  "status": "cancelled",
  "items": [...],
  "total_price": 240000
}
```

**Error Responses:**
- `400`: Cancellation window expired
- `400`: Order not in pending status
- `403`: Not authorized to cancel this order
- `404`: Order not found

### Admin Deletion
```http
DELETE /api/v1/orders/{order_id}
Authorization: Bearer {admin_token}
```

**Success Response (200):**
```json
{
  "id": 123,
  "status": "cancelled",
  ...
}
```

## Code Implementation

### Backend Logic (`app/services/order_service.py`)

```python
def cancel_order(self, order_id: int, user_id: int | None) -> Order:
    # 1. Validate order exists
    # 2. Check ownership
    # 3. Check 2-minute window
    # 4. Check status is "pending"

    # 5. Restore stock with row locking
    for item in order.items:
        food = db.query(Food).filter(
            Food.id == item.food_id
        ).with_for_update().first()

        if food and food.stock_quantity is not None:
            food.stock_quantity += item.quantity
            food.is_available = True

    # 6. Update order status
    order.status = "cancelled"
    db.commit()

    return order
```

### Frontend Integration

```typescript
// Cancel order
const cancelOrder = async (orderId: number) => {
  const response = await api.post(`/orders/${orderId}/cancel`);

  if (response.status === 200) {
    // Order cancelled successfully
    // Stock automatically restored on backend
    return response.data;
  }
};

// Verify stock restoration
const checkStock = async (foodId: number) => {
  const response = await api.get(`/foods?id=${foodId}`);
  return response.data.stock_quantity;
};
```

## Common Issues & Troubleshooting

### Issue 1: Stock Not Restored
**Symptoms:** After cancellation, food quantity unchanged

**Causes:**
- Order status not "pending"
- Cancel request failed silently
- Database transaction not committed

**Debug:**
```bash
# Check order status
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/orders/123

# Check food stock
curl http://localhost:8000/api/v1/foods?id=456
```

### Issue 2: Double Restoration
**Symptoms:** Stock increased more than expected

**Causes:**
- Cancellation endpoint called multiple times
- Race condition in concurrent requests

**Solution:** Tests verify idempotency and row locking

### Issue 3: 403 Forbidden on Cancel
**Symptoms:** User gets 403 when cancelling their own order

**Causes:**
- Wrong token used
- Order belongs to different user
- User ID mismatch

**Debug:**
```python
# Check order ownership
order = db.query(Order).filter(Order.id == 123).first()
print(f"Order user_id: {order.user_id}")
print(f"Current user_id: {current_user.id}")
```

## Test Data

### Sample Foods
```python
FOOD_CATEGORIES = {
    "Ốc": [("Ốc Hương Nướng", 120000, 50)],
    "Nem": [("Nem Chua Rán", 60000, 50)],
    "Đồ Uống": [("Bia Hơi", 15000, 50)],
}
```

### Sample Orders
```python
# Pending order (can cancel)
{
    "status": "pending",
    "created_at": datetime.now() - timedelta(seconds=30),
    "items": [{"food_id": 1, "quantity": 5}]
}

# Confirmed order (cannot cancel as user)
{
    "status": "confirmed",
    "created_at": datetime.now() - timedelta(hours=1),
    "items": [{"food_id": 1, "quantity": 5}]
}
```

## Success Metrics

✅ **All tests pass:**
- 10+ backend test cases
- 8+ frontend test cases
- 100% coverage of cancellation scenarios

✅ **Zero stock discrepancies:**
- Stock always restored accurately
- No double restoration
- No partial restoration

✅ **Proper error handling:**
- Clear error messages
- Correct HTTP status codes
- No silent failures

## Related Documentation
- Backend order service: `app/services/order_service.py`
- Order endpoints: `app/api/v1/endpoints/orders.py`
- Order models: `app/models/order.py`
- Food models: `app/models/food.py`
- Test fixtures: `tests/conftest.py`
