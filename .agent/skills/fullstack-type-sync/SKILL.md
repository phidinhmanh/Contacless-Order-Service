---
name: fullstack-type-sync
description: Ensures backend Pydantic schemas and frontend TypeScript interfaces are always identical.
---

# Fullstack Type Sync Skill

This skill ensures that data structures are synchronized across the entire stack, preventing runtime errors caused by mismatched fields.

## Core Rules

1.  **Change Propagation**: Whenever you modify or create a schema in `app/schemas/`, you MUST check for a corresponding TypeScript interface/type in `frontend/types/` (or the relevant component file).
2.  **Identical Naming**: Use the exact same field names in both Python and TypeScript. Do not convert `snake_case` to `camelCase` unless explicitly required by a specific library convention that handles the mapping automatically.
3.  **Validation Alignment**: If a Pydantic field has validation (e.g., `min_length`, `ge`, `regex`), add equivalent client-side validation logic (e.g., using `zod` or simple conditional checks).

## Checklist

- [ ] **Schema Check**: Does the Pydantic model in `app/schemas/*.py` match the TS interface?
- [ ] **Nullability**: Are fields marked as `Optional` in Python also marked as optional (`?`) in TypeScript?
- [ ] **Enums**: Are Python `Enum` values reflected in TypeScript `enum` or union types?
- [ ] **Integration**: If a new field is added, is it actually used in the frontend components fetching that data?

## Example

### Backend (Pydantic)
```python
class OrderCreate(BaseModel):
    table_id: int
    items: List[OrderItemCreate]
    note: str | None = None
```

### Frontend (TypeScript)
```typescript
interface OrderCreate {
    table_id: number;
    items: OrderItemCreate[];
    note?: string;
}
```
