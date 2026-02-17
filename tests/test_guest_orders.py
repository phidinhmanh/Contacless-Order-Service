from fastapi.testclient import TestClient

from app.models.order import Order
from app.models.table import Table
from app.models.user import User


class TestGuestOrderTracking:
    """Test guest user identification and order tracking functionality."""

    def test_guest_login_returns_user_id(self, client: TestClient, db_session):
        """Test that guest login returns a user_id in the token."""
        # Guest login without table ID
        response = client.post('/api/v1/auth/guest', json={})
        assert response.status_code == 200

        data = response.json()
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert 'user_id' in data
        assert isinstance(data['user_id'], int)

        # Verify the user exists in the database
        guest_user = db_session.query(User).filter(User.id == data['user_id']).first()
        assert guest_user is not None
        assert guest_user.role == 'customer'
        assert guest_user.phone_number is None  # Indicates guest user

    def test_guest_login_with_table_id(self, client: TestClient, db_session):
        """Test that guest login with table ID still returns user_id."""
        # Create a table first
        table = Table(table_number=1, qr_code_path='test_qr', capacity=4)
        db_session.add(table)
        db_session.commit()
        db_session.refresh(table)

        # Guest login with table ID
        response = client.post('/api/v1/auth/guest', json={'table_id': table.id})
        assert response.status_code == 200

        data = response.json()
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert 'user_id' in data
        assert isinstance(data['user_id'], int)

    def test_guest_can_create_order_and_get_it_back(
        self, client: TestClient, db_session
    ):
        """Test that a guest can create an order and retrieve it."""
        # Login as guest
        response = client.post('/api/v1/auth/guest', json={})
        assert response.status_code == 200
        auth_data = response.json()
        guest_user_id = auth_data['user_id']
        headers = {'Authorization': f'Bearer {auth_data["access_token"]}'}

        # Create a table for the order
        table = Table(table_number=2, qr_code_path='test_qr2', capacity=4)
        db_session.add(table)
        db_session.commit()
        db_session.refresh(table)

        # Create a sample food item
        from app.models.category import Category
        from app.models.food import Food

        category = Category(name='Test Category')
        db_session.add(category)
        db_session.commit()
        db_session.refresh(category)

        food = Food(
            name='Test Food',
            description='Test Description',
            price=10.0,
            category_id=category.id,
            is_available=True,
            stock_quantity=10,
        )
        db_session.add(food)
        db_session.commit()
        db_session.refresh(food)

        # Create an order
        order_data = {
            'table_id': table.id,
            'items': [{'food_id': food.id, 'quantity': 2}],
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=headers)
        assert response.status_code == 201
        order_data_response = response.json()
        order_id = order_data_response['id']

        # Verify the order belongs to the guest user
        order = db_session.query(Order).filter(Order.id == order_id).first()
        assert order.user_id == guest_user_id

        # Get the specific order
        response = client.get(f'/api/v1/orders/{order_id}', headers=headers)
        assert response.status_code == 200
        order_response = response.json()
        assert order_response['id'] == order_id

    def test_guest_can_get_their_orders_via_my_orders_endpoint(
        self, client: TestClient, db_session
    ):
        """Test that guest can retrieve their orders using /my-orders endpoint."""
        # Login as guest
        response = client.post('/api/v1/auth/guest', json={})
        assert response.status_code == 200
        auth_data = response.json()
        guest_user_id = auth_data['user_id']
        headers = {'Authorization': f'Bearer {auth_data["access_token"]}'}

        # Create a table for the order
        table = Table(table_number=2, qr_code_path='test_qr2', capacity=4)
        db_session.add(table)
        db_session.commit()
        db_session.refresh(table)

        # Create a sample food item
        from app.models.category import Category
        from app.models.food import Food

        category = Category(name='Test Category')
        db_session.add(category)
        db_session.commit()
        db_session.refresh(category)

        food = Food(
            name='Test Food',
            description='Test Description',
            price=10.0,
            category_id=category.id,
            is_available=True,
            stock_quantity=10,
        )
        db_session.add(food)
        db_session.commit()
        db_session.refresh(food)

        # Create an order
        order_data = {
            'table_id': table.id,
            'items': [{'food_id': food.id, 'quantity': 1}],
        }
        response = client.post('/api/v1/orders/', json=order_data, headers=headers)
        assert response.status_code == 201
        order_data_response = response.json()
        order_id = order_data_response['id']

        # Get orders using /my-orders endpoint
        response = client.get('/api/v1/orders/my-orders', headers=headers)
        assert response.status_code == 200
        orders = response.json()

        # Should only return the guest's order
        assert len(orders) == 1
        assert orders[0]['id'] == order_id
        assert orders[0]['user_id'] == guest_user_id

    def test_guest_cannot_access_registered_users_orders(
        self, client: TestClient, db_session
    ):
        """Test that a guest cannot access registered users' orders."""
        # Create a registered user
        from app.core.security import hash_password
        from app.models.user import User

        registered_user = User(
            phone_number='0123456789',
            full_name='Registered User',
            role='customer',
            hashed_password=hash_password('Password123!'),
            is_active=True,
        )
        db_session.add(registered_user)
        db_session.commit()
        db_session.refresh(registered_user)

        # Login as registered user
        login_data = {'username': '0123456789', 'password': 'Password123!'}
        response = client.post('/api/v1/auth/login', data=login_data)
        assert response.status_code == 200
        auth_data_registered = response.json()
        headers_registered = {
            'Authorization': f'Bearer {auth_data_registered["access_token"]}'
        }

        # Login as guest
        response = client.post('/api/v1/auth/guest', json={})
        assert response.status_code == 200
        auth_data_guest = response.json()
        headers_guest = {'Authorization': f'Bearer {auth_data_guest["access_token"]}'}

        # Create a table
        table = Table(table_number=3, qr_code_path='test_qr3', capacity=4)
        db_session.add(table)
        db_session.commit()
        db_session.refresh(table)

        # Create a sample food item
        from app.models.category import Category
        from app.models.food import Food

        category = Category(name='Test Category')
        db_session.add(category)
        db_session.commit()
        db_session.refresh(category)

        food = Food(
            name='Test Food',
            description='Test Description',
            price=10.0,
            category_id=category.id,
            is_available=True,
            stock_quantity=10,
        )
        db_session.add(food)
        db_session.commit()
        db_session.refresh(food)

        # Registered user creates an order
        order_data = {
            'table_id': table.id,
            'items': [{'food_id': food.id, 'quantity': 1}],
        }
        response = client.post(
            '/api/v1/orders/', json=order_data, headers=headers_registered
        )
        assert response.status_code == 201
        order_data_response = response.json()
        order_id = order_data_response['id']

        # Guest should not be able to access the registered user's order
        response = client.get(f'/api/v1/orders/{order_id}', headers=headers_guest)
        assert response.status_code == 403  # Forbidden

        # Guest should only see their own orders (none in this case)
        response = client.get('/api/v1/orders/my-orders', headers=headers_guest)
        assert response.status_code == 200
        orders = response.json()
        assert len(orders) == 0  # No orders for guest

        # Registered user should be able to access their own order
        response = client.get(f'/api/v1/orders/{order_id}', headers=headers_registered)
        assert response.status_code == 200
        order_response = response.json()
        assert order_response['id'] == order_id

    def test_registered_user_still_has_full_access(
        self, client: TestClient, db_session
    ):
        """Test that registered users (non-guests) still have access to all orders."""
        # Create a registered user
        from app.core.security import hash_password
        from app.models.user import User

        user = User(
            phone_number='0123456789',
            full_name='Test User',
            role='manager',
            hashed_password=hash_password('Password123!'),
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        # Login as registered user
        login_data = {'username': '0123456789', 'password': 'Password123!'}
        response = client.post('/api/v1/auth/login', data=login_data)
        assert response.status_code == 200
        auth_data = response.json()
        headers = {'Authorization': f'Bearer {auth_data["access_token"]}'}

        # Registered user should have access to /orders endpoint (which returns all orders)
        response = client.get('/api/v1/orders/', headers=headers)
        assert response.status_code == 200
        # Even though there might be no orders, the request should succeed
