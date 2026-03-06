from fastapi import status


class TestOrderProcess:
    """TC-ORDER-01 to TC-ORDER-10"""

    def test_tc_order_01_create_valid_order(
        self, client, auth_headers, sample_table, sample_food
    ):
        """TC-ORDER-01: Create Valid Order"""
        order_data = {
            'user_id': 1,  # From create_users fixture (registered user)
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': 2}],
            'special_instructions': 'nhiều sốt',
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=auth_headers)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data['total_price'] == sample_food.price * 2
        assert data['status'] == 'pending'
        assert data['special_instructions'] == 'nhiều sốt'

    def test_tc_order_02_order_unavailable_item(
        self, client, auth_headers, sample_table, unavailable_food
    ):
        """TC-ORDER-02: Order Unavailable Item"""
        order_data = {
            'user_id': 1,
            'table_id': sample_table.id,
            'items': [{'food_id': unavailable_food.id, 'quantity': 1}],
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=auth_headers)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'sold out' in response.json()['detail'].lower()

    def test_tc_order_03_order_non_existent_food(
        self, client, auth_headers, sample_table
    ):
        """TC-ORDER-03: Order Non-existent Food"""
        order_data = {
            'user_id': 1,
            'table_id': sample_table.id,
            'items': [{'food_id': 9999, 'quantity': 1}],
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=auth_headers)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_tc_order_04_real_time_notification(
        self, client, auth_headers, sample_table, sample_food
    ):
        """TC-ORDER-04: Real-time Notification"""
        with client.websocket_connect('/api/v1/ws/kitchen') as websocket:
            order_data = {
                'user_id': 1,
                'table_id': sample_table.id,
                'items': [{'food_id': sample_food.id, 'quantity': 1}],
                'special_instructions': 'không cay',
            }
            client.post('/api/v1/orders/', json=order_data, headers=auth_headers)

            # Receive broadcast message
            payload = websocket.receive_json()
            assert payload['type'] == 'new_order'
            assert payload['data']['special_instructions'] == 'không cay'
            assert payload['data']['items'][0]['food_id'] == sample_food.id

    def test_tc_order_05_order_idempotency(
        self, client, auth_headers, sample_table, sample_food
    ):
        """TC-ORDER-05: Order Idempotency"""
        order_data = {
            'user_id': 1,
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': 1}],
            'idempotency_key': 'idemp-test-123',
        }

        # First call
        resp1 = client.post('/api/v1/orders/', json=order_data, headers=auth_headers)
        assert resp1.status_code == status.HTTP_201_CREATED
        id1 = resp1.json()['id']

        # Second call with same key
        resp2 = client.post('/api/v1/orders/', json=order_data, headers=auth_headers)
        assert resp2.status_code == status.HTTP_201_CREATED
        assert resp2.json()['id'] == id1

    async def test_tc_order_06_race_condition(
        self, async_client, auth_headers, db_session, sample_table
    ):
        """TC-ORDER-06: Race Condition (Row Locking)"""
        import asyncio

        # Set stock to 1
        from app.models.food import Food

        food = Food(
            name='Last Stock Item', price=100, stock_quantity=1, is_available=True
        )
        db_session.add(food)
        db_session.commit()
        db_session.refresh(food)

        order_data = {
            'user_id': 1,
            'table_id': sample_table.id,
            'items': [{'food_id': food.id, 'quantity': 1}],
        }

        # Concurrent requests using asyncio.gather
        results = await asyncio.gather(
            async_client.post(
                '/api/v1/orders/',
                json=order_data,
                headers=auth_headers,
                follow_redirects=True,
            ),
            async_client.post(
                '/api/v1/orders/',
                json=order_data,
                headers=auth_headers,
                follow_redirects=True,
            ),
            return_exceptions=True,
        )

        status_codes = [r.status_code for r in results if hasattr(r, 'status_code')]
        db_session.expire_all()
        db_session.refresh(food)
        assert status.HTTP_201_CREATED in status_codes
        assert status.HTTP_400_BAD_REQUEST in status_codes

    def test_tc_order_07_table_integrity(self, client, db_session, authenticated_user):
        """TC-ORDER-07: Table Integrity"""
        from app.core.security import create_access_token

        # Create token bound to Table 5
        token = create_access_token(
            subject=str(authenticated_user.id), extra_claims={'table_id': 5}
        )
        headers = {'Authorization': f'Bearer {token}'}

        # Try to order for Table 10
        order_data = {
            'user_id': authenticated_user.id,
            'table_id': 10,
            'items': [{'food_id': 1, 'quantity': 1}],
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert 'Table mismatch' in response.json()['detail']

    def test_tc_order_08_special_instructions(
        self, client, auth_headers, sample_table, sample_food
    ):
        """TC-ORDER-08: Special Instructions"""
        instructions = 'không cay, nhiều sốt'
        order_data = {
            'user_id': 1,
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': 1}],
            'special_instructions': instructions,
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=auth_headers)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()['special_instructions'] == instructions

    def test_tc_order_09_cancel_success(
        self, client, auth_headers, recent_order, db_session
    ):
        """TC-ORDER-09: Cancel (Success)"""
        food_id = recent_order.items[0].food_id
        from app.models.food import Food

        initial_stock = (
            db_session.query(Food).filter(Food.id == food_id).first().stock_quantity
        )

        response = client.post(
            f'/api/v1/orders/{recent_order.id}/cancel', headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == 'cancelled'

        # Verify stock restored
        db_session.expire_all()
        final_stock = (
            db_session.query(Food).filter(Food.id == food_id).first().stock_quantity
        )
        assert final_stock == initial_stock + recent_order.items[0].quantity

    def test_tc_order_10_cancel_fail(self, client, auth_headers, old_order):
        """TC-ORDER-10: Cancel (Fail) - Window expired"""
        response = client.post(
            f'/api/v1/orders/{old_order.id}/cancel', headers=auth_headers
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'expired' in response.json()['detail'].lower()

    def test_tc_order_11_status_progression(
        self, client, auth_headers, sample_table, sample_food
    ):
        """Test the full status transition chain: PENDING -> CONFIRMED -> PREPARING -> READY -> COMPLETED"""
        # 1. Create Order (starts as PENDING)
        order_data = {
            'table_id': sample_table.id,
            'items': [{'food_id': sample_food.id, 'quantity': 1}],
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=auth_headers)
        assert response.status_code == status.HTTP_201_CREATED
        order_id = response.json()['id']
        assert response.json()['status'] == 'pending'

        # 2. Advance to CONFIRMED
        response = client.post(
            f'/api/v1/orders/{order_id}/advance', headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == 'confirmed'

        # 3. Advance to PREPARING
        response = client.post(
            f'/api/v1/orders/{order_id}/advance', headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == 'preparing'

        # 4. Advance to READY
        response = client.post(
            f'/api/v1/orders/{order_id}/advance', headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == 'ready'

        # 5. Advance to COMPLETED
        response = client.post(
            f'/api/v1/orders/{order_id}/advance', headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()['status'] == 'completed'

        # 6. Try to advance beyond COMPLETED (should fail)
        response = client.post(
            f'/api/v1/orders/{order_id}/advance', headers=auth_headers
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'Cannot advance' in response.json()['detail']
