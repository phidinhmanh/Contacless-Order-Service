# DB Integrity: Atomic Transaction Examples

## 1. Order Creation with Stock Reduction

This is the most critical flow in the app. If stock reduction fails, the order must not exist. If order creation fails, stock must not be reduced.

```python
def create_order_with_stock(db: Session, order_data: OrderCreate):
    try:
        # 1. Use a transaction block
        with db.begin():
            # 2. Add the order
            new_order = Order(**order_data.dict(exclude={'items'}))
            db.add(new_order)
            db.flush() # Get the order ID without committing

            # 3. Process items and check stock
            for item in order_data.items:
                # IMPORTANT: Use 'with_for_update' to lock the row
                food = db.query(Food).filter(Food.id == item.food_id).with_for_update().first()

                if food.stock < item.quantity:
                    raise StockError(f"Insufficient stock for {food.name}")

                food.stock -= item.quantity

                order_item = OrderItem(order_id=new_order.id, **item.dict())
                db.add(order_item)

        # 4. Transaction is committed automatically at the end of 'with' block
        return new_order
    except Exception as e:
        # 5. DB is automatically rolled back on exception
        logger.error(f"Order failed: {e}")
        raise
```

## 2. Avoiding N+1 Queries

### ❌ BAD (Causes list_dir like latency)
```python
orders = db.query(Order).all()
for order in orders:
    print(order.items) # This triggers 1 sub-query PER ORDER
```

### ✅ GOOD (Single Query with Join)
```python
from sqlalchemy.orm import joinedload

orders = db.query(Order).options(joinedload(Order.items)).all()
# Now access to order.items is pre-loaded and fast!
```
