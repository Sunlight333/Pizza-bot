"""Read-only Evolution API status + QR pairing for the admin panel."""
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.config import settings
from app.services.whatsapp import client as wa_client

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/status")
async def status():
    return await wa_client.instance_status()


@router.get("/qr")
async def qr():
    return await wa_client.fetch_qr()


@router.get("/config")
async def config():
    return {
        "url": settings.evolution_api_url,
        "instance": settings.evolution_instance_name,
        "webhook_url": "/api/webhook/evolution",
        "webhook_secret_set": bool(settings.evolution_webhook_secret),
    }
