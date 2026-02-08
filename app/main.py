from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine
from app.models.base import Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Life span events:
    Startup: 
    - Database tables are now handled by Alembic (external to this code).
    - Ensure cloud resources or caches are warmed up here.
    """
    Base.metadata.create_all(engine, checkfirst=True)
    yield
    """
    Shutdown:
    - Close the database connection pool.
    """
    engine.dispose()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
# Build allowed origins list
allowed_origins = []

if settings.DEBUG:
    # Wide open for local development and testing
    allowed_origins = ["*"]
else:
    # Start with configured origins
    allowed_origins = settings.cors_origins_list if settings.cors_origins_list else []
    
    # Always allow localhost for development
    allowed_origins.extend([
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ])
    
    # If no origins configured, allow trycloudflare.com for testing
    if not settings.cors_origins_list:
        allowed_origins.append("https://*.trycloudflare.com")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.trycloudflare\.com" if not settings.DEBUG else None,
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["system"])
def health_check():
    return {"status": "healthy"}

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", tags=["system"])
def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)