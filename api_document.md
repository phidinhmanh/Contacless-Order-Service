# API Documentation - Contacless Order Service

This document provides a comprehensive overview of the API endpoints for the **Contacless Order Service**. All endpoints are prefixed with `/api/v1`.

---

## 1. Authentication (`/auth`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/auth/register` | Public | Register a new user with phone and password. |
| `POST` | `/auth/login` | Public | Login with phone/password. Returns Access + Refresh tokens. |
| `POST` | `/auth/refresh` | Public | Rotate tokens using a valid Refresh token. |
| `POST` | `/auth/guest` | Public | Login as anonymous guest. Returns 30-day token + persistent cookie. |
| `POST` | `/auth/logout` | Public | Clear persistent guest cookies and end session. |

---

## 2. Menu & Food (`/foods`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/foods/` | Public | Main menu with Pagination, `category` filter, and `include_unavailable` flag. |
| `GET` | `/foods/categories`| Public | Get all unique category names (e.g., Ốc, Nem, Drinks) for UI tabs. |
| `GET` | `/foods/{id}` | Public | Get details of a specific food item. |
| `POST` | `/foods/` | Admin | Create a new food item. |
| `PATCH`| `/foods/{id}/stock`| Staff/Admin | Quick mid-shift stock/availability update. |
| `PUT` | `/foods/{id}` | Admin | Full update of food details. |

---

## 3. Tables (`/tables`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/tables/` | Staff/Admin | List all restaurant tables. |
| `GET` | `/tables/{id}` | Public | Get information about a specific table. |
| `GET` | `/tables/{id}/session`| Public | Returns if the table is `occupied` or `free`. |
| `POST` | `/tables/` | Admin | Add a new table. |

---

## 4. Orders (`/orders`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/orders/` | Customer/Guest | Create a new order. Includes `special_instructions` (e.g., "không cay"). |
| `POST` | `/orders/{id}/cancel`| Customer | Cancel order within **2-minute** safety window. |
| `GET` | `/orders/{id}` | Owner/Staff | Get specific order details. |
| `PUT` | `/orders/{id}` | Staff/Kitchen | Update order status (`pending` -> `preparing` -> `ready`). |
| `GET` | `/orders/table/{tid}`| Staff/Admin | View active/past orders for a specific table. |
| `DELETE`| `/orders/{id}` | Admin | Hard delete an order record. |

*Note: `/orders/user/{uid}` was REMOVED for GDPR compliance. Use `/gdpr/export` instead.*

---

## 5. Payments (`/payments`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/payments/initiate`| Customer | Start payment process for an order. |
| `POST` | `/payments/webhook` | Provider | **Idempotent** receiver for MoMo/VNPay callbacks. |
| `GET` | `/payments/status/{tx}`| Customer | Check status of a transaction. |

---

## 6. Analytics (`/analytics`)

*Requires ADMIN or MANAGER roles (except Inventory Alerts available to STAFF).*

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analytics/revenue` | Summary including Total Revenue and **AOV (Average Order Value)**. |
| `GET` | `/analytics/retention`| 14-day and 30-day customer return rates (3H Growth Model). |
| `GET` | `/analytics/inventory-alerts`| **Predictive**: Shows items likely to sell out based on current order speed. |
| `GET` | `/analytics/peak-hours` | Busiest 30-min intervals analysis. |
| `GET` | `/analytics/tables` | Table Profitability analysis. |
| `GET` | `/analytics/export` | Download full report as `.xlsx` with Retention and Inventory sheets. |

---

## 7. Real-time Kitchen (`/ws`)

| Protocol | Endpoint | Description |
|----------|----------|-------------|
| `WS` | `/ws/kitchen` | WebSocket connection for Kitchen staff to receive live order updates. |

---

## 8. Compliance & GDPR (`/gdpr`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/gdpr/{id}/export` | Owner/Admin | Export all personal data (JSON) as per Right to Access. |
