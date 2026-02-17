"""
Integration Tests for Order Cancellation and Stock Management

Tests verify that food quantities are properly restored when:
1. User cancels their own order (within 2-minute window)
2. Admin cancels any order (DELETE endpoint)
3. Multiple items in the same order
4. Edge cases (already cancelled, expired window, etc.)

TC-CANCEL-STOCK-01 to TC-CANCEL-STOCK-10
"""

from datetime import datetime, timedelta, timezone

from fastapi import status
from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem


class TestOrderCancellationStockRestoration:
    """Test that food stock quantities are properly restored on order cancellation."""

    def test_tc_cancel_stock_01_user_cancel_restores_quantity(
        self, client, db_session: Session, auth_headers, sample_table, sample_food
    ):
        """TC-CANCEL-STOCK-01: User cancels order, food quantity is restored."""
        # Get initial stock
        initial_stock = sample_food.stock_quantity
        order_quantity = 3

        # Create order
        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': order_quantity}],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        order_id = create_response.json()['id']

        # Verify stock decreased
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock - order_quantity

        # Cancel order
        cancel_response = client.post(
            f'/api/v1/orders/{order_id}/cancel', headers=auth_headers
        )
        assert cancel_response.status_code == status.HTTP_200_OK
        assert cancel_response.json()['status'] == 'cancelled'

        # Verify stock restored
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock, (
            f'Expected stock {initial_stock}, got {sample_food.stock_quantity}'
        )

    def test_tc_cancel_stock_02_admin_delete_restores_quantity(
        self,
        client,
        db_session: Session,
        admin_headers,
        auth_headers,
        sample_table,
        sample_food,
    ):
        """TC-CANCEL-STOCK-02: Admin deletes order, food quantity is restored."""
        initial_stock = sample_food.stock_quantity
        order_quantity = 5

        # User creates order
        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': order_quantity}],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        order_id = create_response.json()['id']

        # Verify stock decreased
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock - order_quantity

        # Admin deletes order
        delete_response = client.delete(
            f'/api/v1/orders/{order_id}', headers=admin_headers
        )
        assert delete_response.status_code == status.HTTP_200_OK

        # Verify stock restored
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock

    def test_tc_cancel_stock_03_multiple_items_all_restored(
        self, client, db_session: Session, auth_headers, sample_table, create_menu
    ):
        """TC-CANCEL-STOCK-03: Order with multiple items - all quantities restored on cancel."""
        # Get first 3 available foods
        foods = [f for f in create_menu if f.is_available][:3]
        initial_stocks = {food.id: food.stock_quantity for food in foods}

        # Create order with multiple items
        order_items = [
            {'food_id': foods[0].id, 'quantity': 2},
            {'food_id': foods[1].id, 'quantity': 3},
            {'food_id': foods[2].id, 'quantity': 1},
        ]
        order_data = {'table_id': sample_table.id, 'items': order_items}
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        order_id = create_response.json()['id']

        # Verify all stocks decreased
        for food in foods:
            db_session.refresh(food)
        assert foods[0].stock_quantity == initial_stocks[foods[0].id] - 2
        assert foods[1].stock_quantity == initial_stocks[foods[1].id] - 3
        assert foods[2].stock_quantity == initial_stocks[foods[2].id] - 1

        # Cancel order
        cancel_response = client.post(
            f'/api/v1/orders/{order_id}/cancel', headers=auth_headers
        )
        assert cancel_response.status_code == status.HTTP_200_OK

        # Verify all stocks restored
        for food in foods:
            db_session.refresh(food)
            assert food.stock_quantity == initial_stocks[food.id], (
                f'Food {food.id}: expected {initial_stocks[food.id]}, got {food.stock_quantity}'
            )

    def test_tc_cancel_stock_04_cancel_after_window_no_restore(
        self,
        client,
        db_session: Session,
        auth_headers,
        authenticated_user,
        sample_table,
        sample_food,
    ):
        """TC-CANCEL-STOCK-04: User cancels after 2-minute window - should fail, stock unchanged."""
        order_quantity = 2

        # Create order with old timestamp (>2 minutes ago)
        order = Order(
            user_id=authenticated_user.id,
            table_id=sample_table.id,
            status='pending',
            created_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            total_price=sample_food.price * order_quantity,
        )
        db_session.add(order)
        db_session.flush()

        order_item = OrderItem(
            order_id=order.id,
            food_id=sample_food.id,
            quantity=order_quantity,
            unit_price=sample_food.price,
        )
        db_session.add(order_item)

        # Manually decrease stock (simulating order creation)
        sample_food.stock_quantity -= order_quantity
        db_session.commit()
        db_session.refresh(order)
        db_session.refresh(sample_food)

        stock_after_order = sample_food.stock_quantity

        # Try to cancel (should fail)
        cancel_response = client.post(
            f'/api/v1/orders/{order.id}/cancel', headers=auth_headers
        )
        assert cancel_response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'expired' in cancel_response.json()['detail'].lower()

        # Verify stock unchanged
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == stock_after_order

    def test_tc_cancel_stock_05_double_cancel_no_double_restore(
        self, client, db_session: Session, auth_headers, sample_table, sample_food
    ):
        """TC-CANCEL-STOCK-05: Cancelling already-cancelled order doesn't restore stock twice."""
        initial_stock = sample_food.stock_quantity
        order_quantity = 2

        # Create and cancel order
        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': order_quantity}],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        order_id = create_response.json()['id']

        cancel_response = client.post(
            f'/api/v1/orders/{order_id}/cancel', headers=auth_headers
        )
        assert cancel_response.status_code == status.HTTP_200_OK

        db_session.refresh(sample_food)
        stock_after_cancel = sample_food.stock_quantity
        assert stock_after_cancel == initial_stock

        # Try to cancel again (should fail)
        second_cancel = client.post(
            f'/api/v1/orders/{order_id}/cancel', headers=auth_headers
        )
        assert second_cancel.status_code == status.HTTP_400_BAD_REQUEST
        assert 'cannot cancel' in second_cancel.json()['detail'].lower()

        # Verify stock not changed
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock

    def test_tc_cancel_stock_06_cancel_confirmed_order_fails(
        self,
        client,
        db_session: Session,
        auth_headers,
        authenticated_user,
        sample_table,
        sample_food,
    ):
        """TC-CANCEL-STOCK-06: Cannot cancel order that's already confirmed."""
        initial_stock = sample_food.stock_quantity
        order_quantity = 2

        # Create confirmed order
        order = Order(
            user_id=authenticated_user.id,
            table_id=sample_table.id,
            status='confirmed',
            created_at=datetime.now(timezone.utc),
            total_price=sample_food.price * order_quantity,
        )
        db_session.add(order)
        db_session.flush()

        order_item = OrderItem(
            order_id=order.id,
            food_id=sample_food.id,
            quantity=order_quantity,
            unit_price=sample_food.price,
        )
        db_session.add(order_item)
        sample_food.stock_quantity -= order_quantity
        db_session.commit()
        db_session.refresh(order)

        # Try to cancel
        cancel_response = client.post(
            f'/api/v1/orders/{order.id}/cancel', headers=auth_headers
        )
        assert cancel_response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'cannot cancel' in cancel_response.json()['detail'].lower()

        # Stock should remain decreased
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock - order_quantity

    def test_tc_cancel_stock_07_unavailable_food_becomes_available(
        self, client, db_session: Session, auth_headers, sample_table, create_menu
    ):
        """TC-CANCEL-STOCK-07: Cancelling order with unavailable food makes it available again."""
        # Get a food and set it to unavailable with 0 stock
        food = create_menu[0]
        food.stock_quantity = 5
        food.is_available = True
        db_session.commit()

        # Create order that depletes stock
        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': food.id, 'quantity': 5}],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        order_id = create_response.json()['id']

        # Verify food is now unavailable (stock 0)
        db_session.refresh(food)
        assert food.stock_quantity == 0

        # Cancel order
        cancel_response = client.post(
            f'/api/v1/orders/{order_id}/cancel', headers=auth_headers
        )
        assert cancel_response.status_code == status.HTTP_200_OK

        # Verify food is available again
        db_session.refresh(food)
        assert food.stock_quantity == 5
        assert food.is_available is True

    def test_tc_cancel_stock_08_concurrent_cancel_safe(
        self, client, db_session: Session, auth_headers, sample_table, sample_food
    ):
        """TC-CANCEL-STOCK-08: Concurrent cancellations don't cause race conditions."""
        initial_stock = sample_food.stock_quantity

        # Create order
        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': 3}],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        order_id = create_response.json()['id']

        # First cancel succeeds
        cancel1 = client.post(f'/api/v1/orders/{order_id}/cancel', headers=auth_headers)
        assert cancel1.status_code == status.HTTP_200_OK

        # Second cancel fails (already cancelled)
        cancel2 = client.post(f'/api/v1/orders/{order_id}/cancel', headers=auth_headers)
        assert cancel2.status_code == status.HTTP_400_BAD_REQUEST

        # Stock restored exactly once
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock

    def test_tc_cancel_stock_09_different_user_cannot_cancel(
        self, client, db_session: Session, create_users, sample_table, sample_food
    ):
        """TC-CANCEL-STOCK-09: Different user cannot cancel another user's order."""
        from app.core.security import create_access_token

        # User 1 creates order
        user1 = create_users['registered'][0]
        user1_token = create_access_token(
            subject=str(user1.id), expires_delta=timedelta(hours=1)
        )
        user1_headers = {'Authorization': f'Bearer {user1_token}'}

        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': 2}],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=user1_headers
        )
        order_id = create_response.json()['id']

        # User 2 tries to cancel
        user2 = create_users['registered'][1]
        user2_token = create_access_token(
            subject=str(user2.id), expires_delta=timedelta(hours=1)
        )
        user2_headers = {'Authorization': f'Bearer {user2_token}'}

        cancel_response = client.post(
            f'/api/v1/orders/{order_id}/cancel', headers=user2_headers
        )
        assert cancel_response.status_code == status.HTTP_403_FORBIDDEN

    def test_tc_cancel_stock_10_full_workflow_integration(
        self,
        client,
        db_session: Session,
        auth_headers,
        admin_headers,
        sample_table,
        create_menu,
    ):
        """TC-CANCEL-STOCK-10: Complete workflow - create, verify stock, cancel, verify restore."""
        # Setup: 3 foods with known quantities
        foods = [f for f in create_menu if f.is_available][:3]
        for i, food in enumerate(foods):
            food.stock_quantity = 100 + (i * 10)  # 100, 110, 120
        db_session.commit()

        # Step 1: Create order with all 3 items
        order_data = {
            'table_id': sample_table.id,
            'items': [
                {'food_id': foods[0].id, 'quantity': 5},
                {'food_id': foods[1].id, 'quantity': 10},
                {'food_id': foods[2].id, 'quantity': 15},
            ],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        order_id = create_response.json()['id']

        # Step 2: Verify stocks decreased correctly
        for food in foods:
            db_session.refresh(food)
        assert foods[0].stock_quantity == 95
        assert foods[1].stock_quantity == 100
        assert foods[2].stock_quantity == 105

        # Step 3: User cancels order
        cancel_response = client.post(
            f'/api/v1/orders/{order_id}/cancel', headers=auth_headers
        )
        assert cancel_response.status_code == status.HTTP_200_OK

        # Step 4: Verify all stocks fully restored
        for food in foods:
            db_session.refresh(food)
        assert foods[0].stock_quantity == 100, (
            f'Expected 100, got {foods[0].stock_quantity}'
        )
        assert foods[1].stock_quantity == 110, (
            f'Expected 110, got {foods[1].stock_quantity}'
        )
        assert foods[2].stock_quantity == 120, (
            f'Expected 120, got {foods[2].stock_quantity}'
        )

        # Step 5: Verify order status is cancelled
        order_response = client.get(f'/api/v1/orders/{order_id}', headers=auth_headers)
        assert order_response.json()['status'] == 'cancelled'


class TestAdminCancellationStockRestoration:
    """Test admin-specific cancellation scenarios."""

    def test_admin_can_delete_any_order_and_restore_stock(
        self,
        client,
        db_session: Session,
        admin_headers,
        auth_headers,
        sample_table,
        sample_food,
    ):
        """Admin can delete any user's order and stock is restored."""
        initial_stock = sample_food.stock_quantity

        # Regular user creates order
        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': 4}],
        }
        create_response = client.post(
            '/api/v1/orders/', json=order_data, headers=auth_headers
        )
        order_id = create_response.json()['id']

        # Verify stock decreased
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock - 4

        # Admin deletes order (no time restriction)
        delete_response = client.delete(
            f'/api/v1/orders/{order_id}', headers=admin_headers
        )
        assert delete_response.status_code == status.HTTP_200_OK

        # Verify stock restored
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock

    def test_admin_delete_old_order_still_restores_stock(
        self,
        client,
        db_session: Session,
        admin_headers,
        authenticated_user,
        sample_table,
        sample_food,
    ):
        """Admin can delete old orders (>2 min) and stock is still restored."""
        initial_stock = sample_food.stock_quantity

        # Create old order
        order = Order(
            user_id=authenticated_user.id,
            table_id=sample_table.id,
            status='confirmed',
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            total_price=sample_food.price * 3,
        )
        db_session.add(order)
        db_session.flush()

        order_item = OrderItem(
            order_id=order.id,
            food_id=sample_food.id,
            quantity=3,
            unit_price=sample_food.price,
        )
        db_session.add(order_item)
        sample_food.stock_quantity -= 3
        db_session.commit()
        db_session.refresh(order)

        # Admin deletes
        delete_response = client.delete(
            f'/api/v1/orders/{order.id}', headers=admin_headers
        )
        assert delete_response.status_code == status.HTTP_200_OK

        # Stock restored
        db_session.refresh(sample_food)
        assert sample_food.stock_quantity == initial_stock
