from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine





@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Life span events:
    - Startup: Create database tables (if not using Alembic)
    - Shutdown: Clean up resources
    """
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS configuration
if settings.DEBUG:
    # In debug mode, allow all origins via regex to support LAN/Phone development
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    cors_origins = settings.cors_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins if "*" not in cors_origins else [],
        allow_origin_regex=r"https?://.*" if "*" in cors_origins else None,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# Mount static files for serving images
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    """Root endpoint."""
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
