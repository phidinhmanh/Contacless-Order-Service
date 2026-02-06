---
name: db-integrity
description: Guarantees data consistency using atomic transactions and proper migration patterns.
---

# DB Integrity Skill

This skill ensures the database remains the source of truth and prevents data corruption through race conditions or partial updates.

## Core Rules

1.  **Atomic Transactions**: Any operation involving multiple writes (e.g., Creating an Order + Reducing Stock) MUST be wrapped in a transaction block (`with db.begin():` or manual commit/rollback).
2.  **Alembic Hygiene**: Every schema change MUST be accompanied by a migration. Manually inspect the generated SQL in `alembic/versions/` to ensure it won't drop data.
3.  **Avoid N+1**: When fetching lists of objects with relationships, always use `.options(joinedload(...))` or `.options(subqueryload(...))` to minimize database hits.
4.  **Constraint Enforcement**: Use database-level constraints (Unique, Foreign Key, Check) rather than relying solely on application-level checks.

## Checklist

- [ ] **Concurrency**: What happens if two people order the same "Last Item" at the same time? (Use `with_for_update()` if necessary).
- [ ] **Rollback**: If the second half of a complex save fails, does the first half undo itself?
- [ ] **Migration**: Did you run `alembic revision --autogenerate`?
- [ ] **Efficiency**: Are you fetching related items in a single query?

## Example

### Atomic Order Processing
```python
try:
    with db.begin():
        # Create order
        db.add(new_order)
        # Reduce food stock
        for item in items:
            food = db.query(Food).filter(Food.id == item.food_id).with_for_update().first()
            if food.stock < item.quantity:
                raise StockError("Insufficient stock")
            food.stock -= item.quantity
except Exception:
    # SQLALchemy automatically rolls back if an exception occurs inside 'with db.begin():'
    raise
```
