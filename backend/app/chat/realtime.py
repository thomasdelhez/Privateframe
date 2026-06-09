import json
from collections import defaultdict
from uuid import UUID

from fastapi import WebSocket


class ChatRealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[str(user_id)].add(websocket)

    def disconnect(self, user_id: UUID, websocket: WebSocket) -> None:
        key = str(user_id)
        sockets = self._connections.get(key)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(key, None)

    async def send_to_user(self, user_id: UUID, payload: dict) -> None:
        data = json.dumps(payload, default=str)
        stale: list[WebSocket] = []
        for socket in self._connections.get(str(user_id), set()):
            try:
                await socket.send_text(data)
            except Exception:
                stale.append(socket)

        for socket in stale:
            self.disconnect(user_id, socket)


chat_realtime_hub = ChatRealtimeHub()
