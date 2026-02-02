# Customer System Requirements

This document specifies the system requirements for each customer-facing interaction flow in the **Contacless Order Service**, aligned with Phase 1 verification standards.

---

## 1. Authentication & Account Management

### R-AUTH-01: User Registration
- **Format:** System must validate Vietnamese phone numbers (`0...` or `+84...`).
- **Complexity:** Passwords must be hashed using **bcrypt** with a minimum of **12 rounds**.
- **Strength:** Passwords must require at least 8 characters, including uppercase, lowercase, and digits.
- **Uniqueness:** Phone numbers must be unique; system must return `400 Bad Request` for duplicates.

### R-AUTH-03: Guest Checkout
- **Mechanism:** System must support anonymous ordering by creating a temporary guest account.
- **Session Duration:** The anonymous session (JWT) must reside for **30+ days** to enable Long-Term Value (LTV) tracking and marketing analysis.
- **Transformation:** Guest accounts can optionally be upgraded to full accounts by adding a phone number and password later.

### R-ORDER-03: Creation Idempotency
- **Resilience:** Order creation must support an `idempotency_key`.
- **Deduplication:** System must prevent duplicate orders if the same key is submitted within a reasonable timeframe (e.g., handling network lag/double-clicks).

### R-ORDER-04: Inventory Safety (Race Conditions)
- **Mechanism:** System must implement **Row-Level Locking** (`SELECT ... FOR UPDATE`) during order processing.
- **Validation:** Must check real-time `stock_quantity` before confirming an order to prevent overselling "Last Plate" items.

### R-ORDER-05: Table Session Integrity
- **Binding:** Scanned QR table sessions must be cryptographically bound to the access token.
- **Enforcement:** Orders submitted with a `table_id` inconsistent with the QR-session token must be rejected with `403 Forbidden`.

### R-AUTH-02: Secure Authentication
- **Mechanism:** Must use **OAuth2 with JWT Bearer tokens**.
- **Expiration:** Access tokens must expire exactly in **24 hours**.
- **Persistence:** Refresh tokens must allow rotation to maintain session safety.
- **Privacy:** Plaintext passwords must **never** be stored or logged.

---

## 2. Digital Menu & Browsing

### R-MENU-01: Real-time Availability
- **Filtering:** Only food items marked as `is_available = True` should be displayed on the customer menu.
- **Categorization:** Menu must be filterable by food category (e.g., drinks, main course).

---

## 3. Ordering System Integrity

### R-ORDER-01: Calculation Accuracy
- **Critical:** All order totals must be calculated on the **server-side** to prevent price manipulation from the frontend.
- **Validation:** System must verify that `user_id`, `table_id`, and `food_id` exist before order confirmation.

### R-ORDER-02: Persistence & Notification
- **Integrity:** Every order must be written to the database before the customer receives a confirmation.
- **Performance:** New orders must be broadcast to the kitchen via **WebSocket** within a **2-second** SLA.

---

## 4. Payment Critical Path

### R-PAY-01: Idempotency
- **Critical:** The payment webhook receiver **must** be idempotent. It must use a unique `transaction_id` from the provider to prevent double-charging or duplicate order fulfillment.

### R-PAY-02: Timeout & Rollback
- **Safety:** Pending payments must expire after **15 minutes**.
- **Rollback:** If a payment fails or expires, the system must automatically reset the associated Order status to `pending`.

### R-PAY-03: Security
- **Verification:** Webhook signatures from providers (MoMo, VNPay, etc.) must be verified to prevent spoofing.

---

## 5. GDPR & Data Privacy

### R-GDPR-01: Right to Access (Export)
- **Compliance:** System must provide an endpoint for customers to download all their personal data in a machine-readable format (JSON).
- **Security:** Customers can only access their own data; **Staff/Kitchen** roles must be blocked from user data export.

### R-GDPR-02: Data Sanitization
- **Logging:** Personal customer data (especially passwords) must **never** appear in application error logs.
- **Retention:** Customer data must include a "last login" timestamp for retention policy enforcement.
