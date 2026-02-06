---
name: security-auditor
description: Enforces Role-Based Access Control (RBAC) and data isolation on every API endpoint.
---

# Security Auditor Skill

This skill ensures that every piece of data and every action is properly protected and isolated.

## Core Rules

1.  **Default Deny**: Every endpoint in `app/api/v1/endpoints/` must explicitly define its access requirements using `require_role` or `get_current_user`.
2.  **Table Isolation**: For customer-facing endpoints, you MUST verify that the `table_id` in the JWT payload matches the context of the request (e.g., checking if the order belongs to that table).
3.  **Token Authority**: Never trust a user ID or table ID provided in the request body if it can be securely extracted from the `payload` of a verified JWT.
4.  **Least Privilege**: Grant the minimum necessary role (e.g., Use `UserRole.STAFF` instead of `UserRole.ADMIN` if staff access is sufficient).

## Checklist

- [ ] **Role Check**: Is there a `Depends(require_role(...))` call?
- [ ] **Ownership Check**: If modifying an existing resource, is the owner (or authorized role) verified?
- [ ] **No ID Leakage**: Are we returning sensitive fields like `password_hash` in schemas? (Verify `response_model` usage).
- [ ] **Table Boundary**: Is a customer limited only to their scanned table's data?

## Example

### Proper Table Protection
```python
@router.get("/my-orders")
def get_table_orders(
    db: Session = Depends(get_db),
    table_id: int = Depends(get_current_table_id) # Extracted from token
):
    # Customer can ONLY see orders for their scanned table
    return db.query(Order).filter(Order.table_id == table_id).all()
```
