import os
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
    openapi_url=f'{settings.API_V1_STR}/openapi.json',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

app.include_router(api_router, prefix='/v1')


@app.get('/health', tags=['system'])
def health_check():
    return {'status': 'healthy'}


app.mount('/static', StaticFiles(directory='static'), name='static')


@app.get('/', tags=['system'])
def root():
    return {'message': f'Welcome to {settings.PROJECT_NAME}'}


if __name__ == '__main__':
    import uvicorn

    HOST = os.getenv('HOST', '127.0.0.1')
    PORT = int(os.getenv('PORT', 8000))
    uvicorn.run('app.main:app', host=HOST, port=PORT, reload=True)
