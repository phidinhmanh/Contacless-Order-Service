from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.food import Food

def test_view_available_items(client: TestClient, db_session: Session):
    """TC-MENU-01: View Available Items"""
    category = Category(name="Test", description="Test category", display_order=1)
    db_session.add(category)
    db_session.flush()
    # Setup: 5 available, 2 unavailable
    for i in range(5):
        food = Food(name=f"Available {i}", price=10.0, category=category, is_available=True)
        db_session.add(food)
    for i in range(2):
        food = Food(name=f"Unavailable {i}", price=10.0, category=category, is_available=False)
        db_session.add(food)
    db_session.commit()

    response = client.get("/api/v1/foods/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    for item in data:
        assert item["is_available"] is True

def test_category_filtering(client: TestClient, db_session: Session):
    """TC-MENU-02: Category Filtering"""
    drinks = Category(name="Drinks", description="Drink category", display_order=1)
    foods_category = Category(name="Foods", description="Food category", display_order=2)
    db_session.add_all([drinks, foods_category])
    db_session.flush()
    # Setup: 3 Drinks, 2 Foods
    for i in range(3):
        food = Food(name=f"Drink {i}", price=5.0, category=drinks, is_available=True)
        db_session.add(food)
    for i in range(2):
        food = Food(name=f"Food {i}", price=15.0, category=foods_category, is_available=True)
        db_session.add(food)
    db_session.commit()

    response = client.get(f"/api/v1/foods/?category_id={drinks.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    for item in data:
        assert item["category_id"] == drinks.id

def test_fetch_categories(client: TestClient, db_session: Session):
    """TC-MENU-03: Fetch Categories"""
    # Setup: items in "Ốc", "Nem", "Drinks"
    categories = ["Ốc", "Nem", "Drinks"]
    for index, cat in enumerate(categories, start=1):
        category = Category(name=cat, description=f"{cat} category", display_order=index)
        db_session.add(category)
    db_session.commit()

    response = client.get("/api/v1/foods/categories")
    assert response.status_code == 200
    data = response.json()
    # Note: create_menu fixture might already have categories, so we check if ours are present
    returned_names = {item["name"] for item in data}
    for cat in categories:
        assert cat in returned_names

def test_menu_pagination(client: TestClient, db_session: Session):
    """TC-MENU-04: Menu Pagination"""
    category = Category(name="Test", description="Test category", display_order=1)
    db_session.add(category)
    db_session.flush()
    # Setup: 15 items
    for i in range(15):
        food = Food(name=f"Food {i:02d}", price=10.0, category=category, is_available=True)
        db_session.add(food)
    db_session.commit()

    # Get all items first to see the full list and confirm sorting (default is by ID)
    # Testing skip=5, limit=5
    response = client.get("/api/v1/foods/?skip=5&limit=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 5
    
    # Verify it's items 6-10 (depending on existing data in db)
    # Since we use a fresh db_session in each test (from conftest.py), 
    # and we just added 15 items, they should be IDs 1-15.
    # skip=5 means we skip 1,2,3,4,5. So we get 6,7,8,9,10.
    # We can check the names we just added.
    # Note: if conftest.py's create_menu is used, it might add items too.
    # But here we are adding 15 more.
