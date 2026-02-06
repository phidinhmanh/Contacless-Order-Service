"""
Kitchen WebSocket endpoint for real-time order updates.
Security disabled for development/testing ease.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.websocket import manager
from app.models.order import Order

router = APIRouter()

@router.websocket("/ws/kitchen")
async def kitchen_websocket(websocket: WebSocket):    
    # Just accept everything. No tokens, no checks.
    await websocket.accept()
    print("🚀 WS Kitchen: Connection accepted (Security: Disabled)")
    
    await manager.connect(websocket, channel="kitchen")
    try:
        while True:
            # Keep the pipe open
            data = await websocket.receive_text()
            if data == "ping":
                await manager.send_personal_message({"type": "pong"}, websocket)
    except WebSocketDisconnect:
        print("🔌 WS Kitchen: Connection closed")
        manager.disconnect(websocket, channel="kitchen")

async def broadcast_new_order(order: Order):
    """
    Broadcast new order to kitchen.
    Called from order service after order creation.
    """
    message = {
        "type": "new_order",
        "order_id": order.id,
        "data": {
            "id": order.id,
            "table_id": order.table_id,
            "status": order.status,
            "total_price": float(order.total_price) if order.total_price else 0,
            "special_instructions": order.special_instructions,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "items": [
                {
                    "food_id": item.food_id,
                    "quantity": item.quantity,
                    "food_name": item.food.name if item.food else "Unknown",
                }
                for item in order.items
            ] if order.items else [],
        }
    }
    await manager.broadcast(message, channel="kitchen")

async def broadcast_order_update(order: Order, update_type: str = "order_update"):
    """
    Broadcast order status update to kitchen.
    """
    message = {
        "type": update_type,
        "order_id": order.id,
        "data": {
            "id": order.id,
            "status": order.status,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
        }
    }
    await manager.broadcast(message, channel="kitchen")