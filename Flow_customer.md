# Customer Interaction Flow and Function Calls

This document traces the sequence of function calls and logic execution when a customer interacts with the **Contacless Order Service**.

---

## 1. Account Creation and Authentication

### Registration
**Endpoint:** `POST /api/v1/auth/register`
1. **Entry:** `app.api.v1.endpoints.auth.register(user_in, db)`
2. **Validation:** `app.crud.user.get_by_phone(db, phone_number)` (checks for duplicates)
3. **Logic:** `app.core.security.hash_password(password)` (bcrypt 12 rounds)
4. **Persistence:** `db.add(user)`, `db.commit()`, `db.refresh(user)`

### Login
**Endpoint:** `POST /api/v1/auth/login`
1. **Entry:** `app.api.v1.endpoints.auth.login(form_data, db)`
2. **Lookup:** `app.crud.user.get_by_phone(db, phone_number)`
3. **Verification:** `app.core.security.verify_password(plain, hashed)`
4. **Token Generation:** 
   - `app.core.security.create_access_token(user_id)` (24h expiry)
   - `app.core.security.create_refresh_token(user_id)` (7d expiry)

### Guest Authentication (Anonymous)
**Endpoint:** `POST /api/v1/auth/guest`
1. **Entry:** `app.api.v1.endpoints.auth.login_as_guest(db, response, table_id)`
2. **Recognition:** System checks for `guest_user_id` cookie. 
   - If found and valid: reuses existing `User` profile (TC-AUTH-07).
3. **Login:** Creates `User` record if not found.
4. **Cookie:** Sets `HttpOnly` cookie `guest_user_id` (30-day persistence).
5. **Token Generation:** 
   - `app.core.security.create_access_token(user_id, expires_delta=30 days)`
   - Claims: Includes `table_id` if provided via QR scan (TC-ORDER-07).

### Logout
**Endpoint:** `POST /api/v1/auth/logout`
1. **Entry:** `app.api.v1.endpoints.auth.logout(response)`
2. **Logic:** Calls `response.delete_cookie("guest_user_id")`
3. **Result:** Persistent guest session is cleared.

---

## 2. Browsing the Menu

### Category Fetching
**Endpoint:** `GET /api/v1/foods/categories`
1. **Entry:** `app.api.v1.endpoints.foods.get_categories(db)`
2. **Fetch:** `app.crud.food.crud_food.get_categories(db)`
3. **Query:** `db.query(Food.category).distinct().all()`

### Menu Retrieval (Filtered & Paginated)
**Endpoint:** `GET /api/v1/foods/`
1. **Entry:** `app.api.v1.endpoints.foods.get_menu(db, skip, limit, category, include_unavailable)`
2. **Fetch:** `app.crud.food.crud_food.get_multi_with_filters(...)`
3. **Logic:** Applies `WHERE` filters for category and `is_available` status.

---

## 3. Placing an Order

**Endpoint:** `POST /api/v1/orders/`
1. **Entry:** `app.api.v1.endpoints.orders.create_order(order_in, db, current_user, table_id_from_token)`
2. **Idempotency:** System checks for `idempotency_key` in payload.
   - If key exists and order found: returns existing order (prevents duplicates).
3. **Table Integrity:** Verifies `order_in.table_id` matches `table_id_from_token` from JWT.
4. **Service:** `app.services.order_service.OrderService.create_order(order_in)`
   - **User Check:** `db.query(User).filter(User.id == user_id)`
   - **Table Check:** `db.query(Table).filter(Table.id == table_id)`
   - **Note:** Sets `special_instructions` from payload.
   - **Item Loop (Row Locking):**
     - `db.query(Food).filter(Food.id == food_id).with_for_update()`
     - **Stock Check:** Verifies `food.stock_quantity >= item.quantity`
     - **Update:** Decrements `food.stock_quantity`. Mark `is_available=False` if zero.
   - **Persistence:** `db.add(order)`, `db.add(order_item)`, `db.commit()`

---

## 4. Order Management

### Cancellation (Safety Window)
**Endpoint:** `POST /api/v1/orders/{id}/cancel`
1. **Entry:** `app.api.v1.endpoints.orders.cancel_order(order_id, db, current_user)`
2. **Logic:** `app.services.order_service.OrderService.cancel_order(order_id, user_id)`
   - **Time Check:** Verifies `now - order.created_at <= 2 minutes`.
   - **Status Check:** Verifies order is still `pending`.
   - **Stock Restoration:** Iterates items and increments `food.stock_quantity`.
3. **Persistence:** `order.status = "cancelled"`, `db.commit()`

---

## 5. Payment Processing

### Initiation
**Endpoint:** `POST /api/v1/payments/initiate`
1. **Entry:** `app.api.v1.endpoints.payments.initiate_payment(payment_in, db, current_user)`
2. **Service:** `app.services.payment_service.PaymentService.initiate_payment(payment_in)`
   - **Order Check:** `db.query(Order).filter(Order.id == order_id)`
   - **Idempotency:** Checks for existing `PENDING` payment for the same order.
   - **Logic:** Sets `expires_at` to `now + 15 minutes`.
   - **Persistence:** `db.add(payment)`, `db.commit()`

### Webhook (Provider Callback)
**Endpoint:** `POST /api/v1/payments/webhook`
1. **Entry:** `app.api.v1.endpoints.payments.payment_webhook(payload, db)`
2. **Service:** `app.services.payment_service.PaymentService.process_webhook(payload)`
   - **Idempotency Check:** `db.query(Payment).filter(Payment.transaction_id == payload.transaction_id)`
   - **Status Mapping:** `_map_provider_status(payload.status)`
   - **Order Update:** 
     - If `COMPLETED`: `order.status = "paid"`
     - If `FAILED`: `order.status = "pending"` (automatic rollback)
   - **Persistence:** `db.commit()`

---

## 6. Table Session Management

**Endpoint:** `GET /api/v1/tables/{id}/session`
1. **Entry:** `app.api.v1.endpoints.tables.get_table_session(table_id, db)`
2. **Logic:** Checks for orders with statuses `['pending', 'confirmed', 'preparing', 'ready']`.
3. **Result:** Returns `occupied` if active orders exist, else `free`.

---

## 7. Advanced Analytics (3H Model)

### Retention Tracking
**Endpoint:** `GET /api/v1/analytics/retention`
1. **Logic:** Computes % of users returned within 14 and 30 day windows.
2. **Metric:** Essential for "Intelligent Investor" LTV analysis.

### Predictive Inventory Alerts
**Endpoint:** `GET /api/v1/analytics/inventory-alerts`
1. **Logic:** Calculates velocity (units/hour) over the last 24h.
2. **Alert:** Triggers if `current_stock` will be depleted in `< 24h`.

---

## 8. GDPR Data Management

### Personal Data Export
**Endpoint:** `GET /api/v1/gdpr/{user_id}/export`
1. **Entry:** `app.api.v1.endpoints.gdpr.export_user_data(user_id, db, current_user)`
2. **Auth:** Checks `current_user.id == user_id` or `current_user.role == "admin"`
3. **Fetch:**
   - `db.query(User).filter(User.id == user_id)`
   - `db.query(Order).filter(Order.user_id == user_id)`
4. **Response:** `JSONResponse` with all personal records, including order history.
