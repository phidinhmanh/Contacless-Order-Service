# Customer Flow Test Cases

This document defines the test scenarios that must be satisfied for the customer journey in the **Contacless Order Service**.

---

## 1. Authentication & Session Management

| ID | Scenario | Pre-conditions | Expected Result | Status |
|----|----------|----------------|-----------------|--------|
| ID | Scenario | Pre-conditions | Expected Result | Status |
|----|----------|----------------|-----------------|--------|
| TC-AUTH-01 | Successful Registration | Valid VN phone, strong password | User created, password hashed, 201 Created | ✅ |
| TC-AUTH-02 | Duplicate Registration | Phone already exists | 400 Bad Request, error message | ✅ |
| TC-AUTH-03 | Weak Password | Password < 8 chars or no uppercase | 422 Unprocessable Content (Schema validation) | ✅ |
| TC-AUTH-04 | Successful Guest Login | None | Guest user created, 30-day JWT returned | ✅ |
| TC-AUTH-05 | Standard User Login | Valid credentials | 24h JWT returned, `last_login` updated | ✅ |
| TC-AUTH-06 | Token Rotation | Valid refresh token | New Access + Refresh token pair returned | ✅ |
| TC-AUTH-07 | Guest Re-entry | Clear LocalStorage, keep Cookie | System recognizes previous `user_id`, resumes LTV session | ✅ |
| TC-AUTH-08 | User Logout | Persistent session cookie exists | Cookie `guest_user_id` deleted, session ended | ✅ |

---

## 2. Digital Menu

| ID | Scenario | Pre-conditions | Expected Result | Status |
|----|----------|----------------|-----------------|--------|
| TC-MENU-01 | View Available Items | DB has 5 available, 2 unavailable | Only 5 available items are returned | ✅ |
| TC-MENU-02 | Category Filtering | Filter by "Drinks" | Only items with category "Drinks" returned | ✅ |
| TC-MENU-03 | Fetch Categories | DB has items in "Ốc", "Nem", "Drinks" | List `["Ốc", "Nem", "Drinks"]` returned for UI tabs | ✅ |
| TC-MENU-04 | Menu Pagination | `skip=5`, `limit=5` | Returns items 6-10 from the sorted list | ✅ |

---

## 3. Ordering Process

| ID | Scenario | Pre-conditions | Expected Result | Status |
|----|----------|----------------|-----------------|--------|
| TC-ORDER-01 | Create Valid Order | Auth user, menu items available | Order created, total price verified, total price saved | ✅ |
| TC-ORDER-02 | Order Unavailable Item | Food `is_available = False` | 400 Bad Request, "Food not available" | ✅ |
| TC-ORDER-03 | Order Non-existent Food | Invalid `food_id` | 404 Not Found | ✅ |
| TC-ORDER-04 | Real-time Notification | Order created | WebSocket client on `/ws/kitchen` receives payload within 2s | ✅ |
| TC-ORDER-05 | Order Idempotency | Send same `idempotency_key` twice | 2nd call returns existing order ID, no duplicate cook ticket | ✅ |
| TC-ORDER-06 | Race Condition | 2 orders for last 1 stock at same sec | 1st succeeds, 2nd receives 400 "Sold Out" (Row Locking) | ✅ |
| TC-ORDER-07 | Table Integrity | Scanned Table 5, POST table_id=10 | 403 Forbidden (Session bound to Table 5) | ✅ |
| TC-ORDER-08 | Special Instructions | POST "không cay, nhiều sốt" | Instructions saved and visible in Kitchen WS payload | ✅ |
| TC-ORDER-09 | Cancel (Success) | Cancel within 120s of creation | Status → CANCELLED, stock restored to Food model | ✅ |
| TC-ORDER-10 | Cancel (Fail) | Cancel after 150s of creation | 400 Bad Request, "Window expired" | ✅ |

---

## 4. Payment Gateway Integration

| ID | Scenario | Pre-conditions | Expected Result | Status |
|----|----------|----------------|-----------------|--------|
| TC-PAY-01 | Payment Initiation | Valid order ID | Payment record created with 15m expiration | ✅ |
| TC-PAY-02 | Duplicate Initiation | Order already has PENDING payment | Existing pending payment returned (Idempotent) | ✅ |
| TC-PAY-03 | Successful Webhook | Valid transaction ID | Payment status → COMPLETED, Order status → PAID | ✅ |
| TC-PAY-04 | Webhook Idempotency | Send same SUCCESS webhook twice | Second call returns success without double-processing | ✅ |
| TC-PAY-05 | Failed Webhook | Provider sends FAILURE | Payment status → FAILED, Order status → PENDING (Rollback) | ✅ |
| TC-PAY-06 | Payment Timeout | Expiration time passed | Payment marked FAILED, Order marked PENDING | ✅ |

---

## 5. Table & Analytics (3H Model)

| ID | Scenario | Pre-conditions | Expected Result | Status |
|----|----------|----------------|-----------------|-------|
| TC-TABLE-01 | Table Status | Table 5 has active order | `GET /tables/5/session` returns `occupied` | ✅ |
| TC-ANA-01 | Retention Rate | User returned after 14 days | `GET /analytics/retention` reflects returner in 14d rate | ✅ |
| TC-ANA-02 | Inventory Alert | Item "Ốc Hương" stock will last 5h | `GET /analytics/inventory-alerts` returns HIGH priority alert | ✅ |

---

## 6. GDPR & Compliance

| ID | Scenario | Pre-conditions | Expected Result | Status |
|----|----------|----------------|-----------------|--------|
| TC-GDPR-01 | Self Data Export | Authenticated User A exports A | Full JSON profile + order history returned | ✅ |
| TC-GDPR-02 | Unauthorized Export | User A tries export User B | 403 Forbidden | ✅ |
| TC-GDPR-03 | Data Privacy | View User JSON | `hashed_password` must be absent from payload | ✅ |
| TC-SEC-01 | Sensitive History | GET `/orders/user/{uid}` | 404/405 (Endpoint REMOVED for security) | ✅ |
