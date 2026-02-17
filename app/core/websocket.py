"""
WebSocket connection manager for real-time updates.
Used by kitchen, dashboard, and other real-time features.
"""

import asyncio
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """
    Manages WebSocket connections for real-time broadcasting.
    Supports multiple channels (e.g., kitchen, dashboard, tables).
    """

    def __init__(self):
        # channel_name -> set of WebSocket connections
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str = 'default'):
        """Register a WebSocket connection."""
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)

    def disconnect(self, websocket: WebSocket, channel: str = 'default'):
        """Remove a WebSocket connection."""
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to a specific connection."""
        await websocket.send_json(message)

    async def broadcast(self, message: dict, channel: str = 'default'):
        """Broadcast message to all connections in a channel."""
        if channel not in self.active_connections:
            return

        disconnected = set()
        for connection in list(self.active_connections[channel]):
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
            except asyncio.CancelledError:
                disconnected.add(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn, channel)

    async def broadcast_to_all(self, message: dict):
        """Broadcast message to all channels."""
        for channel in self.active_connections:
            await self.broadcast(message, channel)


# Global connection manager instance
manager = ConnectionManager()
