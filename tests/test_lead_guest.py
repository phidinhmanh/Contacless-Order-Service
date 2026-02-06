import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.models.user import User, UserRole
from app.models.table import Table
from app.models.table_session import TableSession
from app.models.order import Order, OrderStatus
from app.core.security import create_access_token
from app.schemas.payment import CassoWebhookPayload, CassoTransaction

def test_lead_guest_flow(client: TestClient, db_session: Session):
    db = db_session
    # 1. Setup: Create Table
    table = Table(table_number=999, capacity=4)
    db.add(table)
    db.commit()
    db.refresh(table)

    # 2. Guest scans QR and sets guest count (Session Creation)
    # Login as guest first to get token
    login_res = client.post("/api/v1/auth/guest", json={"table_id": table.id})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Session
    session_res = client.post(
        f"/api/v1/tables/{table.id}/session",
        json={"guest_count": 3},
        headers=headers
    )
    assert session_res.status_code == 200
    session_data = session_res.json()
    assert session_data["guest_count"] == 3
    assert session_data["status"] == "active"

    # Verify DB
    db_session = db.query(TableSession).filter(TableSession.table_id == table.id).first()
    assert db_session is not None
    assert db_session.guest_count == 3

    # 3. Cart Checkout trigger: Update Lead Guest Info
    lead_info = {
        "full_name": "Nguyen Van A",
        "phone_number": "0987654321"
    }
    update_res = client.patch(
        "/api/v1/users/me/lead-info",
        params=lead_info,
        headers=headers
    )
    assert update_res.status_code == 200
    user_data = update_res.json()
    assert user_data["full_name"] == "Nguyen Van A"
    assert user_data["phone_number"] == "0987654321"

    # Verify User in DB
    user_id = user_data["id"]
    user = db.query(User).filter(User.id == user_id).first()
    assert user.full_name == "Nguyen Van A"

    # 4. Payment Webhook Name Parsing (The "Invisible Handshake")
    # Reset name to test parsing if it wasn't set (or test overwriting if logic permits, 
    # but my logic only updates if missing/Guest. So let's create a NEW order/user context 
    # or just manually reset name for testing this specific part)
    
    # Let's try another flow for the payment parsing: 
    # Anonymous guest orders, pays, and we get name from bank.
    
    # Create another table/user
    table2 = Table(table_number=888, capacity=2)
    db.add(table2)
    db.commit()
    db.refresh(table2)
    
    # Login guest 2
    login_res2 = client.post("/api/v1/auth/guest", json={"table_id": table2.id})
    token2 = login_res2.json()["access_token"]
    user2_id = db.query(User).filter(User.phone_number == None).order_by(User.id.desc()).first().id
    
    # Create Order
    order = Order(
        user_id=user2_id,
        table_id=table2.id,
        total_price=100000,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    # Call Webhook
    payload = {
        "error": 0,
        "data": [
            {
                "id": "TRX001",
                "tid": "BANK001",
                "description": f"THANH TOAN DON OC_{order.id} TRAN THI B chuyen khoan",
                "amount": 100000,
                "when": "2023-10-27T10:00:00",
                "bank_sub_acc_id": "0000"
            }
        ]
    }
    
    webhook_res = client.post("/api/v1/payments/webhook/casso", json=payload)
    assert webhook_res.status_code == 200
    
    # Verify User2 Name Updated
    db.refresh(order)
    assert order.status == "paid"
    user2 = db.query(User).filter(User.id == user2_id).first()
    # Logic: "TRAN THI B" should be extracted
    # My regex/heuristic: removes "THANH TOAN DON", "OC_...", "CHUYEN KHOAN".
    # Remaining: " TRAN THI B " -> stripped "TRAN THI B".
    assert user2.full_name == "Tran Thi B"

