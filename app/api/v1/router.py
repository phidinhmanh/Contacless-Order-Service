from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics,
    auth,
    categories,
    foods,
    gdpr,
    kitchen,
    menu,
    orders,
    payments,
    tables,
    users,
)

api_router = APIRouter(redirect_slashes=False)

# Authentication routes
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Resource routes
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(foods.router, prefix="/foods", tags=["foods"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(tables.router, prefix="/tables", tags=["tables"])
api_router.include_router(menu.router, prefix="/menu", tags=["menu"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(gdpr.router, prefix="/gdpr", tags=["gdpr"])
api_router.include_router(kitchen.router, tags=["kitchen"])
