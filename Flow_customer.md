# Contacless Order Service - Project Summary & Customer Flow

## Project Overview

**Contacless Order Service** is a modern, mobile-first restaurant ordering system that enables customers to place orders via QR codes without requiring staff interaction. Built with Python/FastAPI backend and Next.js/React frontend, it provides a seamless contactless dining experience with real-time kitchen integration and secure payment processing.

### Key Features
- **QR Code Table Ordering**: Customers scan table QR codes to access digital menus
- **Guest Authentication**: Anonymous ordering with optional account creation
- **Real-time Inventory**: Prevents overselling with row-level locking
- **VietQR Payments**: Bank transfer payments via QR codes
- **Kitchen Dashboard**: Live order tracking and status updates
- **Analytics**: Business intelligence with retention metrics and inventory alerts
- **GDPR Compliance**: Right to data access and privacy controls

### Technology Stack
- **Backend**: Python 3.13, FastAPI, SQLAlchemy, PostgreSQL, Alembic
- **Frontend**: Next.js 16, React 18, TypeScript, Tailwind CSS
- **Database**: PostgreSQL with Alembic migrations
- **Authentication**: JWT with OAuth2, bcrypt password hashing
- **Real-time**: WebSocket connections for kitchen updates
- **Payments**: VietQR integration with Casso.vn webhook processing
- **Deployment**: Docker-ready with uvicorn server

---

## Customer Interaction Flow and Function Calls

This document traces the sequence of function calls and logic execution when a customer interacts with the **Contacless Order Service**, including QR scanning, real-time updates, and payment processing.

---

## System Architecture Overview

### Core Components

1. **Frontend (Next.js)**
   - Mobile-first responsive design
   - Zustand state management for cart
   - WebSocket integration for real-time updates
   - QR code scanning for table access

2. **Backend (FastAPI)**
   - RESTful API with versioning (/api/v1)
   - JWT-based authentication
   - WebSocket server for kitchen notifications
   - Background task processing

3. **Database (PostgreSQL)**
   - Users, Orders, Foods, Tables, Payments models
   - Alembic for database migrations
   - Row-level locking for inventory safety

4. **Payment Integration**
   - VietQR for bank transfers
   - Casso.vn webhook processing
   - Idempotent payment handling

---

## 1. QR Code & Session Start

### Scanning & Entry
**Action:** Customer scans QR code on the table.
**URL Format:** `http://localhost:3000/?table={id}` (e.g., `?table=5`)

### System Entry Point
**Frontend:** `frontend/app/page.tsx` - Handles initial QR parameter parsing
**Backend Validation:** Table existence check before session creation

### Session Status Check
**Endpoint:** `GET /api/v1/tables/{id}/session`
1. **Entry:** `app.api.v1.endpoints.tables.get_table_session(table_id, db)`
2. **Logic:** Checks for active orders for this table.
   - **Active Statuses:** `['pending', 'confirmed', 'preparing', 'ready']`
   - **Query:** `db.query(Order).filter(Order.table_id == table_id, Order.status.in_(active_statuses))`
3. **Result:** 
   - Returns `occupied` if active orders exist (Frontend prompts to join existing session or alerts manager).
   - Returns `free` if no active orders (Customer proceeds to login/guest).

### Security Considerations
- Table session binding prevents order manipulation
- JWT tokens include table_id for validation
- Guest sessions persist for 30+ days for analytics

### Guest Authentication (Table Binding)
**Endpoint:** `POST /api/v1/auth/guest`
1. **Entry:** `app.api.v1.endpoints.auth.login_as_guest(db, response, table_id)`
2. **Recognition:** Checks for existing `guest_user_id` cookie.
   - If found: Reuses existing `User` profile (TC-AUTH-07).
3. **Creation:** Creates new `User` record if not found.
4. **Token Generation:** 
   - `app.core.security.create_access_token`
   - **Claim:** Includes `table_id` in the JWT payload if provided. This binds the user's session to the specific table (TC-ORDER-07).
5. **Cookie:** Sets `guest_user_id` (30-day persistence).

### Authentication Flow
```
1. Customer scans QR → /?table=5
2. Check table session → GET /api/v1/tables/5/session
3. If free → Guest auth → POST /api/v1/auth/guest
4. Receive JWT with table binding
5. Access menu with authenticated session
```

---

## 2. Browsing the Menu

### Category Fetching
**Endpoint:** `GET /api/v1/foods/categories`
1. **Entry:** `app.api.v1.endpoints.foods.get_categories(db)`
2. **Query:** `db.query(Food.category).distinct()`

### Menu Retrieval
**Endpoint:** `GET /api/v1/foods/`
1. **Entry:** `app.api.v1.endpoints.foods.get_menu(db, skip, limit, category)`
2. **Logic:** Fetches available food items, supports filtering by category.

### Real-time Inventory
- **Stock Checking:** `Food.stock_quantity` field tracks inventory
- **Availability:** `is_available` flag controls menu display
- **Auto-update:** Stock decrements on order creation, sets `is_available=False` when stock=0
- **Race Condition Prevention:** Row-level locking with `with_for_update()` during order processing

---

## 3. Placing an Order

### Order Creation
**Endpoint:** `POST /api/v1/orders/`
1. **Entry:** `app.api.v1.endpoints.orders.create_order(order_in, db, current_user, table_id_from_token)`
2. **Security Check (Table Integrity):**
   - Verifies `order_in.table_id` matches `table_id_from_token` from JWT.
   - Prevents users from ordering for other tables (TC-ORDER-07).
3. **Idempotency:** Checks `idempotency_key` to prevent duplicate submissions.
4. **Service:** `app.services.order_service.OrderService.create_order`
   - **Stock Check:** Locks rows (`with_for_update()`) and verifies `stock_quantity >= quantity`.
   - **Inventory Update:** Decrements stock. auto-sets `is_available=False` if stock hits 0.
   - **Persistence:** Saves Order and OrderItems.
5. **Real-time Notification:**
   - **Action:** `background_tasks.add_task(broadcast_new_order, order)`
   - **WebSocket:** Sends `new_order` event to all KITCHEN/BAR connected clients.

### Order Data Flow
```
Frontend Cart → POST /api/v1/orders/ → OrderService.create_order()
→ Validate stock with row locking → Decrement inventory
→ Save to DB → Broadcast via WebSocket → Kitchen receives notification
```

---

## 4. Order Management

### Cancellation (Safety Window)
**Endpoint:** `POST /api/v1/orders/{id}/cancel`
1. **Entry:** `app.api.v1.endpoints.orders.cancel_order`
2. **Service Logic:**
   - **Time Check:** Allowed only within 2 minutes of active creation.
   - **Status Check:** Order must be `pending`.
   - **Stock Restoration:** Increments `stock_quantity` for all items.
3. **Notification:** Broadcasts `order_cancelled` event to Kitchen.

### Order Status Lifecycle
```
pending → confirmed → preparing → ready → paid → completed
     ↓
  cancelled
```

### Kitchen Integration
- **WebSocket Endpoint:** `/ws/kitchen` for real-time order updates
- **Connection Manager:** `app.core.websocket.ConnectionManager`
- **Event Types:** `new_order`, `order_cancelled`, `payment_confirmed`, `status_updated`

---

## 5. Payment Processing

### Initiation (VietQR)
**Endpoint:** `POST /api/v1/payments/initiate`
1. **Entry:** `app.api.v1.endpoints.payments.initiate_payment`
2. **Service:** `app.services.payment_service.PaymentService.initiate_payment`
   - **Check:** Verifies order status is `pending` or `confirmed`.
   - **Idempotency:** Returns existing `PENDING` payment if one exists.
   - **Creation:** Creates Payment record with `expires_at = now + 15 mins`.
3. **QR Generation:**
   - Calls `PaymentService.generate_vietqr_url`
   - **Format:** `https://img.vietqr.io/image/...`
   - **Transfer Content:** `THANH TOAN DON OC_{order_id}` (Critical for matching).

### Webhook (Casso / Bank Transfer)
**Endpoint:** `POST /api/v1/payments/webhook`
1. **Entry:** `app.api.v1.endpoints.payments.payment_webhook`
2. **Payload:** Receives bank transaction details from Casso.
3. **Service:** `app.services.payment_service.PaymentService.process_webhook`
   - **Extraction:** Regex parses `OC_{order_id}` from transaction description.
   - **Matching:** Finds corelating Order and Payment records.
   - **Validation:** checks `transaction.amount >= order.total_price`.
4. **Completion:**
   - Updates Payment status to `COMPLETED`.
   - Updates Order status to `paid`.
5. **Real-time Notification:**
   - **WebSocket:** Broadcasts `payment_confirmed` to Kitchen/Manager.
   - **Message:** "Đơn hàng #{id} đã thanh toán!"

### Payment Security
- **Idempotency:** Transaction IDs prevent duplicate processing
- **Timeout Handling:** 15-minute expiration with automatic rollback
- **Signature Verification:** Casso webhook signatures validated
- **Amount Validation:** Transaction amount must cover order total

---

## 6. Automated Background Tasks

### Expired Payment Cleanup
**Function:** `app.services.payment_service.PaymentService.check_expired_payments`
1. **Trigger:** Periodic scheduler (e.g., Celery/APScheduler).
2. **Logic:** Finds payments where `status == PENDING` and `expires_at < now`.
3. **Action:**
   - Sets Payment status to `FAILED`.
   - Rolls back Order status to `pending` (allows retry).

### Analytics Processing
**Service:** `app.services.analytics_service.AnalyticsService`
- **Revenue Reports:** Daily/weekly summaries with AOV calculation
- **Peak Hours:** 30-minute interval analysis in Vietnam timezone
- **Retention Metrics:** 14-day and 30-day customer return rates
- **Inventory Alerts:** Predictive stock depletion warnings
- **Table Performance:** Revenue analysis by table location

---

## 7. GDPR & Data Compliance

**Endpoint:** `GET /api/v1/gdpr/{user_id}/export`
- Exports all user data including order history in JSON format.
- Strictly allows access only to `self` or `ADMIN`.

### Privacy Features
- **Data Minimization:** Only necessary customer information stored
- **Right to Access:** Full data export capability
- **Secure Logging:** No passwords or PII in application logs
- **Retention Policy:** Based on last login timestamp
- **Guest Anonymity:** Optional account creation with persistent sessions

### Audit Trail
- **Audit Model:** `app.models.audit.AuditLog` tracks sensitive operations
- **Compliance Logging:** Authentication events, data exports, role changes
- **Timestamped Records:** All actions logged with precise timing

---

## System Monitoring & Operations

### Health Checks
- **Endpoint:** `GET /health` - Basic system health
- **Database:** Connection pool monitoring
- **WebSocket:** Active connection counts

### Error Handling
- **Structured Logging:** All errors logged with context
- **User-friendly Messages:** Technical errors abstracted for frontend
- **Fallback Mechanisms:** Graceful degradation for payment failures

### Performance Metrics
- **Response Times:** API endpoint SLA tracking
- **Database Queries:** Query optimization with indexing
- **WebSocket Latency:** Real-time update delivery times

### Testing Coverage
- **Unit Tests:** Model and service layer validation
- **Integration Tests:** API endpoint testing
- **E2E Tests:** Playwright browser automation
- **Load Testing:** Performance under concurrent users

---

## Deployment & Infrastructure

### Development Setup
```bash
# Backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -e .[dev]
alembic upgrade head
python main.py

# Frontend
cd frontend
npm install
npm run dev
```

### Production Considerations
- **Containerization:** Docker images for consistent deployment
- **Database:** PostgreSQL with connection pooling
- **Caching:** Redis for session storage (future enhancement)
- **Monitoring:** Logging aggregation and alerting
- **Scaling:** Horizontal scaling for API instances

### Environment Configuration
- **.env file:** Database credentials, API keys, secrets
- **Config Management:** `app.core.config.Settings` with pydantic validation
- **Security:** Separate configs for dev/staging/production

---

## Future Enhancements

### Planned Features
1. **Loyalty Program:** Points system for returning customers
2. **Table Reservations:** Online booking integration
3. **Multi-language Support:** English, Chinese interfaces
4. **Advanced Analytics:** Predictive ordering and demand forecasting
5. **Mobile App:** Native iOS/Android applications
6. **Kitchen Display System:** Dedicated hardware for order management

### Technical Improvements
- **Caching Layer:** Redis for menu and category data
- **Message Queue:** Celery for background tasks
- **Rate Limiting:** API protection against abuse
- **Audit Logging:** Comprehensive operational tracking
- **Backup Strategy:** Automated database backups

---

## Conclusion

The Contacless Order Service provides a complete solution for modern restaurant operations, combining customer convenience with business intelligence. Its architecture emphasizes security, reliability, and scalability while maintaining simplicity for end-users. The system's modular design allows for easy extension and customization to meet specific restaurant requirements.

**Key Success Factors:**
- Mobile-first design ensures broad accessibility
- Real-time updates improve kitchen efficiency
- Secure payment processing builds customer trust
- Comprehensive analytics enable data-driven decisions
- GDPR compliance protects customer privacy

This documentation serves as both a technical reference and operational guide for maintaining and extending the system.