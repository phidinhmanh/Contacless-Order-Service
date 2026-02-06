import pytest
from fastapi import status
from datetime import UTC, datetime, timedelta, timezone
from app.models.payment import PaymentStatus, PaymentProvider
from app.models.order import OrderStatus


class TestPaymentIntegration:
    """TC-PAY-01 to TC-PAY-07: VietQR and Casso payment tests"""

    def test_tc_pay_01_payment_initiation(self, client, auth_headers, sample_order):
        """TC-PAY-01: Payment Initiation - Valid order ID with VietQR"""
        payload = {
            "order_id": sample_order.id,
            "provider": PaymentProvider.VIETQR.value,
            "amount": sample_order.total_price
        }
        response = client.post("/api/v1/payments/initiate", json=payload, headers=auth_headers)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["order_id"] == sample_order.id
        assert data["status"] == PaymentStatus.PENDING.value
        assert data["expires_at"] is not None
        
        # VietQR should return QR URL and bank details
        assert "qr_url" in data
        assert "vietqr.io" in data["qr_url"]
        assert data["bank_id"] is not None
        assert data["transfer_content"] is not None
        assert f"OC_{sample_order.id}" in data["transfer_content"]
        
        # Verify 15m expiration (approx)
        expires_at_str = data["expires_at"].replace("Z", "")
        expires_at = datetime.fromisoformat(expires_at_str)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        diff = expires_at - now
        assert timedelta(minutes=14) < diff < timedelta(minutes=16)

    def test_tc_pay_02_duplicate_initiation(self, client, auth_headers, sample_order):
        """TC-PAY-02: Duplicate Initiation - Order already has PENDING payment"""
        payload = {
            "order_id": sample_order.id,
            "provider": PaymentProvider.VIETQR.value,
            "amount": sample_order.total_price
        }
        # First initiation
        response1 = client.post("/api/v1/payments/initiate", json=payload, headers=auth_headers)
        assert response1.status_code == status.HTTP_201_CREATED
        id1 = response1.json()["id"]

        # Second initiation
        response2 = client.post("/api/v1/payments/initiate", json=payload, headers=auth_headers)
        assert response2.status_code == status.HTTP_201_CREATED
        id2 = response2.json()["id"]

        # Should be idempotent - return same record
        assert id1 == id2

    def test_tc_pay_03_successful_webhook(self, client, sample_order):
        """TC-PAY-03: Successful Webhook - Valid transaction ID"""
        txn_id = "TXN_SUCCESS_123"
        payload = {
            "transaction_id": txn_id,
            "order_id": sample_order.id,
            "amount": sample_order.total_price,
            "status": "success",
            "provider": "vietqr"
        }
        response = client.post("/api/v1/payments/webhook", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == PaymentStatus.COMPLETED.value
        assert data["transaction_id"] == txn_id
        
    def test_tc_pay_04_webhook_idempotency(self, client, sample_order):
        """TC-PAY-04: Webhook Idempotency - Send same SUCCESS webhook twice"""
        txn_id = "TXN_IDEMP_456"
        payload = {
            "transaction_id": txn_id,
            "order_id": sample_order.id,
            "amount": sample_order.total_price,
            "status": "success",
            "provider": "vietqr"
        }
        # First call
        response1 = client.post("/api/v1/payments/webhook", json=payload)
        assert response1.status_code == status.HTTP_200_OK
        
        # Second call
        response2 = client.post("/api/v1/payments/webhook", json=payload)
        assert response2.status_code == status.HTTP_200_OK
        
        assert response1.json()["id"] == response2.json()["id"]

    def test_tc_pay_05_failed_webhook(self, client, sample_order):
        """TC-PAY-05: Failed Webhook - Provider sends FAILURE"""
        txn_id = "TXN_FAIL_789"
        payload = {
            "transaction_id": txn_id,
            "order_id": sample_order.id,
            "amount": sample_order.total_price,
            "status": "failed",
            "provider": "vietqr"
        }
        response = client.post("/api/v1/payments/webhook", json=payload)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == PaymentStatus.FAILED.value

    def test_tc_pay_06_payment_timeout(self, client, db_session, sample_order):
        """TC-PAY-06: Payment Timeout - Expiration time passed"""
        from app.models.payment import Payment
        expired_payment = Payment(
            order_id=sample_order.id,
            amount=sample_order.total_price,
            provider="vietqr",
            status=PaymentStatus.PENDING.value,
            expires_at=datetime.now(UTC) - timedelta(minutes=1)
        )
        db_session.add(expired_payment)
        db_session.commit()

        from app.models.user import User, UserRole
        manager = User(
            phone_number="0999999999",
            hashed_password="hashed",
            full_name="Manager",
            role=UserRole.MANAGER.value
        )
        db_session.add(manager)
        db_session.commit()
        
        from app.core.security import create_access_token
        manager_token = create_access_token(subject=str(manager.id))
        headers = {"Authorization": f"Bearer {manager_token}"}
        
        response = client.post("/api/v1/payments/check-expired", headers=headers)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["expired_count"] >= 1
        
        db_session.refresh(expired_payment)
        assert expired_payment.status == PaymentStatus.FAILED.value
        
        db_session.refresh(sample_order)
        assert sample_order.status == "pending"


class TestCassoWebhook:
    """TC-CASSO-01 to TC-CASSO-04: Casso webhook tests"""

    def test_tc_casso_01_successful_transfer(self, client, db_session, sample_order):
        """TC-CASSO-01: Casso webhook with valid transfer matching order"""
        payload = {
            "error": 0,
            "data": [{
                "id": "CASSO_TXN_001",
                "description": f"THANH TOAN DON OC_{sample_order.id}",
                "amount": sample_order.total_price,
                "when": "2026-02-03 15:00:00"
            }]
        }
        response = client.post("/api/v1/payments/webhook/casso", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        assert data["processed_count"] == 1
        
        # Verify order status updated to paid
        db_session.refresh(sample_order)
        assert sample_order.status == "paid"

    def test_tc_casso_02_idempotency(self, client, db_session, sample_order):
        """TC-CASSO-02: Same Casso transaction processed twice"""
        payload = {
            "error": 0,
            "data": [{
                "id": "CASSO_TXN_IDEMP",
                "description": f"THANH TOAN DON OC_{sample_order.id}",
                "amount": sample_order.total_price
            }]
        }
        # First call
        response1 = client.post("/api/v1/payments/webhook/casso", json=payload)
        assert response1.status_code == status.HTTP_200_OK
        payment_ids_1 = response1.json()["payment_ids"]
        
        # Second call - should return same payment
        response2 = client.post("/api/v1/payments/webhook/casso", json=payload)
        assert response2.status_code == status.HTTP_200_OK
        payment_ids_2 = response2.json()["payment_ids"]
        
        assert payment_ids_1 == payment_ids_2

    def test_tc_casso_03_underpaid_transfer(self, client, db_session, sample_order):
        """TC-CASSO-03: Transfer amount less than order total"""
        payload = {
            "error": 0,
            "data": [{
                "id": "CASSO_TXN_UNDERPAID",
                "description": f"THANH TOAN DON OC_{sample_order.id}",
                "amount": sample_order.total_price - 1000  # Underpaid
            }]
        }
        response = client.post("/api/v1/payments/webhook/casso", json=payload)
        assert response.status_code == status.HTTP_200_OK
        # Should not process underpaid transactions
        assert response.json()["processed_count"] == 0
        
        # Order should remain pending
        db_session.refresh(sample_order)
        assert sample_order.status == "pending"

    def test_tc_casso_04_invalid_order_id(self, client):
        """TC-CASSO-04: Transfer with non-existent order ID"""
        payload = {
            "error": 0,
            "data": [{
                "id": "CASSO_TXN_INVALID",
                "description": "THANH TOAN DON OC_999999",  # Non-existent order
                "amount": 50000
            }]
        }
        response = client.post("/api/v1/payments/webhook/casso", json=payload)
        assert response.status_code == status.HTTP_200_OK
        # Should skip transactions with invalid order
        assert response.json()["processed_count"] == 0
