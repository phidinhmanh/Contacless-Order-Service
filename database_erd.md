# Database ERD

This document contains the Entity-Relationship Diagram (ERD) for the "Contacless Order Service" database, generated using Mermaid syntax.

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Order : places
    User ||--o{ TableSession : leads
    User ||--o{ AuditLog : performs
    Table ||--o{ Order : restricted_to
    Table ||--o{ TableSession : has
    Food ||--o{ OrderItem : included_in
    Order ||--|{ OrderItem : contains
    Order ||--o{ Payment : paid_by

    User {
        int id PK
        string phone_number
        string full_name
        string gender
        string age_group
        string hashed_password
        string role
        boolean is_active
        boolean is_verified
        datetime created_at
        datetime last_login
    }

    Table {
        int id PK
        int table_number
        int capacity
        boolean is_occupied
        string qr_code_path
    }

    Food {
        int id PK
        string name
        float price
        string category
        boolean is_available
        string description
        string image_url
        int stock_quantity
        datetime created_at
    }

    TableSession {
        int id PK
        int table_id FK
        int lead_user_id FK
        int guest_count
        string status
        datetime created_at
        datetime closed_at
    }

    Order {
        int id PK
        int user_id FK
        int table_id FK
        float total_price
        string status
        string idempotency_key
        string special_instructions
        datetime created_at
        datetime updated_at
    }

    OrderItem {
        int id PK
        int order_id FK
        int food_id FK
        int quantity
        float unit_price
    }

    Payment {
        int id PK
        int order_id FK
        float amount
        string currency
        string status
        string provider
        string transaction_id
        string provider_response
        datetime created_at
        datetime updated_at
        datetime completed_at
        datetime expires_at
    }

    AuditLog {
        int id PK
        string entity_type
        int entity_id
        string action
        text old_value
        text new_value
        int user_id FK
        string ip_address
        string user_agent
        datetime created_at
    }
```

## Description of Entities

- **User**: Represents customers, staff, and managers. Stores profile and authentication data.
- **Table**: Represents physical tables in the restaurant with QR code tracking.
- **Food**: The digital menu items, including pricing and stock levels.
- **TableSession**: Tracks a group of guests at a specific table, led by a "lead user".
- **Order**: Represents a customer order, linked to a user and a table.
- **OrderItem**: Individual line items within an order, linking to specific food items.
- **Payment**: Tracks payment transactions via various providers (VietQR, Cash, etc.).
- **AuditLog**: Security and compliance log for tracking critical system actions.
