"""
Analytics Tests - TC-ANA-01 to TC-ANA-02 and TC-TABLE-01
"""

import pytest
from fastapi import status


from datetime import UTC, datetime, timedelta, timezone
from app.models.order import OrderStatus, Order, OrderItem
from app.models.payment import Payment, PaymentStatus

class TestTableStatus:
    """TC-TABLE-01"""
    
    def test_table_session_status_occupied(self, client, db_session, sample_table, sample_food, authenticated_user):
        """TC-TABLE-01: Table Status Check - Occupied"""
        # Create an active order for the table
        order = Order(
            user_id=authenticated_user.id,
            table_id=sample_table.id,
            status=OrderStatus.PENDING,
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(order)
        db_session.commit()
        
        response = client.get(f"/api/v1/tables/{sample_table.id}/session")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "occupied"
        assert data["table_id"] == sample_table.id

    def test_table_session_status_free(self, client, sample_table):
        """TC-TABLE-01: Table Status Check - Free"""
        response = client.get(f"/api/v1/tables/{sample_table.id}/session")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "free"


class TestRetentionAnalytics:
    """TC-ANA-01"""
    
    def test_retention_rate_calculation(self, client, db_session, admin_headers, create_users):
        """TC-ANA-01: Retention Rate (User returned after 14 days)"""
        now = datetime.now(UTC)
        fourteen_days_ago = now - timedelta(days=14)
        twenty_days_ago = now - timedelta(days=20)
        
        # 1. Create a historical user who ordered 20 days ago
        user = create_users["registered"][0]
        user.created_at = twenty_days_ago
        
        old_order = Order(
            user_id=user.id,
            table_id=1,
            status=OrderStatus.PAID,
            created_at=twenty_days_ago
        )
        db_session.add(old_order)
        db_session.commit()
        
        # 2. Same user orders again today (within 14d window from 'now')
        new_order = Order(
            user_id=user.id,
            table_id=1,
            status=OrderStatus.PENDING,
            created_at=now
        )
        db_session.add(new_order)
        db_session.commit()
        
        response = client.get("/api/v1/analytics/retention", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Should reflect 1 returning user in 14d window
        assert data["returning_users_14d"] >= 1
        assert "rate_14d" in data


    def test_customer_segments_demographics(self, client, db_session, admin_headers, create_users):
        """TC-ANA-01: Customer Segments Demographics"""
        # 1. Create users with specific demographics
        user1 = create_users["registered"][0]
        user1.gender = "male"
        user1.age_group = "25_34"
        
        user2 = create_users["registered"][1]
        user2.gender = "female"
        user2.age_group = "18_24"
        
        db_session.add_all([user1, user2])
        db_session.commit()
        
        # 2. Create sessions for these users
        from app.models.table_session import TableSession
        session1 = TableSession(table_id=1, lead_user_id=user1.id, status="closed")
        session2 = TableSession(table_id=2, lead_user_id=user2.id, status="closed")
        db_session.add_all([session1, session2])
        db_session.commit()
        
        response = client.get("/api/v1/analytics/customers", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Verify demographics
        assert data["demographics"]["gender"]["male"] >= 1
        assert data["demographics"]["gender"]["female"] >= 1
        assert data["demographics"]["age_groups"]["25_34"] >= 1
        assert data["demographics"]["age_groups"]["18_24"] >= 1
    """TC-ANA-02"""
    
    def test_inventory_alerts_high_priority(self, client, db_session, admin_headers, sample_food):
        """TC-ANA-02: Inventory Alert (High Priority)"""
        # Set stock to 5
        sample_food.name = "Ốc Hương"
        sample_food.stock_quantity = 5
        db_session.add(sample_food)
        db_session.commit()
        
        # Create orders in last 24h to generate velocity
        # Velocity = 24 items / 24 hours = 1.0 item/hr
        # 5 stock / 1.0 velocity = 5 hours left (< 6h threshold for HIGH)
        for _ in range(200):
            order = Order(table_id=1, status=OrderStatus.PAID, created_at=datetime.now(UTC) - timedelta(hours=2))
            db_session.add(order)
            db_session.flush()
            item = OrderItem(order_id=order.id, food_id=sample_food.id, quantity=1, unit_price=sample_food.price)
            db_session.add(item)
        
        db_session.commit()
        
        response = client.get("/api/v1/analytics/inventory-alerts?hours=24", headers=admin_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Find the alert for Ốc Hương
        alert = next((a for a in data if a["food_name"] == "Ốc Hương"), None)
        assert alert is not None
        assert alert["priority"] == "HIGH"
        assert alert["estimated_hours_remaining"] <= 5.0
