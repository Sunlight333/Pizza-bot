"""WebSocket connection manager — broadcasts order events to all admin clients."""
import asyncio
from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)

    async def broadcast(self, event: str, data: Any) -> None:
        payload = {"event": event, "data": data}
        dead: list[WebSocket] = []
        async with self._lock:
            conns = list(self._connections)
        for ws in conns:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._connections.discard(ws)


manager = ConnectionManager()
