# Security Auditor: Reference Examples

## 1. Table Isolation (Insecure vs Secure)

### ❌ INSECURE: Trusting User Input
```python
@router.get("/orders/{table_id}")
def get_orders_by_table(table_id: int, db: Session = Depends(get_db)):
    # ANYONE can see orders for table_id if they guess the number!
    return db.query(Order).filter(Order.table_id == table_id).all()
```

### ✅ SECURE: Trusting JWT Payload
```python
@router.get("/my-orders")
def get_my_orders(
    db: Session = Depends(get_db),
    table_id: int = Depends(get_current_table_id) # Validated from token
):
    # User can only see orders for the table they actually scanned
    return db.query(Order).filter(Order.table_id == table_id).all()
```

## 2. Role-Based Access Control (RBAC)

### ❌ INSECURE: No Permission Check
```python
@router.delete("/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    # Any anonymous user could call this!
    db.query(Order).filter(Order.id == order_id).delete()
    db.commit()
```

### ✅ SECURE: Specific Role Requirement
```python
@router.delete("/orders/{order_id}")
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.MANAGER))
):
    # Only staff with high privilege can delete orders
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = "cancelled"
    db.commit()
```
