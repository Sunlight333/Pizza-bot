import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import (
    admin,
    auth,
    bot_config,
    bridge,
    conversations,
    customers,
    delivery,
    evolution,
    health,
    menu,
    orders,
    webhook,
)
from app.config import settings
from app.logging_config import configure as configure_logging
from app.middleware.rate_limit import limiter
from app.services import scheduler as scheduler_svc

configure_logging()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("pizzabot api starting", extra={"cors": settings.cors_origins_list})
    scheduler_svc.start()
    yield
    scheduler_svc.shutdown()
    log.info("pizzabot api stopping")


app = FastAPI(
    title="Pizzabot API",
    version="0.1.0",
    description="WhatsApp ordering bot backend",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Too many requests"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    log.exception("unhandled exception", extra={"path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(menu.router, prefix="/api/menu", tags=["menu"])
app.include_router(delivery.router, prefix="/api/delivery", tags=["delivery"])
app.include_router(customers.router, prefix="/api/customers", tags=["customers"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(orders.public_router, prefix="/api/orders", tags=["orders"])
app.include_router(webhook.router, prefix="/api/webhook", tags=["webhook"])
app.include_router(bridge.router, prefix="/api/bridge", tags=["bridge"])
app.include_router(bot_config.router, prefix="/api/bot/config", tags=["bot"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["conversations"])
app.include_router(evolution.router, prefix="/api/evolution", tags=["evolution"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])

# Uploaded product photos (see /api/menu/products/upload-image). The mount lives
# next to the API so /media/products/<file>.jpg is served by the same origin
# and stored URLs work without CORS or extra config.
MEDIA_ROOT = Path(__file__).resolve().parent.parent / "media"
(MEDIA_ROOT / "products").mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_ROOT), name="media")


@app.get("/")
async def root():
    return {"service": "pizzabot-api", "version": "0.1.0"}
