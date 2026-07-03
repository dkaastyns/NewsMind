from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.health import router as health_router
from app.routers.pipeline import router as pipeline_router

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(pipeline_router)

app.include_router(api_router)


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "version": "2.0.0-simplified",
        "status": "ready",
        "docs": "/docs",
        "api_base_path": "/api/v1",
    }
