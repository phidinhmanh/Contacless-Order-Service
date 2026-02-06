---
name: frontend-engineering
description: Standards for frontend development, focusing on correct API usage and backend-driven logic.
---

# Frontend Engineering Skill

This skill ensures that frontend development adheres to the project's architectural standards, specifically regarding data fetching and business logic.

## Core Principles

1.  **Backend-Driven Logic**: The frontend must avoid calculating business metrics (e.g., revenue, order counts, retention rates) if a backend endpoint exists to provide that data.
2.  **API First**: Always check for existing endpoints in `app/api/v1/endpoints/` before implementing client-side filtering or aggregation.
3.  **Analytics Integration**: Use the `/analytics/*` space for any stats or reporting features.

## Checklists

### Dashboard & Reporting
- [ ] **No Self-Calculation**: Are you calculating revenue or counts from raw arrays? Use `/analytics/revenue` instead.
- [ ] **Real-time Data**: Use WebSocket notifications for UI updates instead of polling where possible, but for stats, use the analytics service.
- [ ] **Table Status**: Use the `/tables/` endpoint to get authoritative table states (e.g., `occupied`, `available`) rather than inferring from order lists.

### API Integration
- [ ] **Typed Responses**: Ensure TypeScript interfaces match the backend Pydantic schemas.
- [ ] **Error Handling**: Use the centralized `api` client (`lib/api.ts`) to ensure consistent error toast notifications.
- [ ] **Efficient Fetching**: Use `Promise.all()` for independent data fetches to minimize loading times.

## Example: Proper Data Fetching
Instead of fetching all orders and filtering locally:
```typescript
// BAD: local calculation
const res = await api.get('/orders');
const todayRevenue = res.data.filter(o => isToday(o.date)).reduce((a, b) => a + b.total, 0);

// GOOD: backend analytics
const res = await api.get('/analytics/revenue');
const todayRevenue = res.data.total_revenue;
```
