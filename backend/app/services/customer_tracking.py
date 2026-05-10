"""Per-order WebSocket fanout for the public tracking page.

Distinct from app.services.websocket.manager (which fans out every
order event to every admin client). Here, each customer subscribes by
a single order_id and only receives updates for that order — no
cross-tenant leakage.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)


class TrackingManager:
    def __init__(self) -> None:
        self._subs: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, order_id: int, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._subs.setdefault(order_id, set()).add(ws)

    async def unsubscribe(self, order_id: int, ws: WebSocket) -> None:
        async with self._lock:
            bucket = self._subs.get(order_id)
            if bucket is not None:
                bucket.discard(ws)
                if not bucket:
                    self._subs.pop(order_id, None)

    async def notify(self, order_id: int, event: str, data: Any) -> None:
        async with self._lock:
            bucket = list(self._subs.get(order_id, set()))
        if not bucket:
            return
        payload = {"event": event, "data": data}
        dead: list[WebSocket] = []
        for ws in bucket:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                bucket = self._subs.get(order_id)
                if bucket:
                    for ws in dead:
                        bucket.discard(ws)


tracking_manager = TrackingManager()
