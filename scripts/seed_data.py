"""
Sample data script to populate the database with Vietnamese food items and tables.
Run with: uv run python scripts/seed_data.py
"""

from app.db.session import SessionLocal
from app.models.food import Food
from app.models.table import Table


def seed_foods(db):
    """Seed sample Vietnamese food items with placeholder images."""
    foods = [
        {
            "name": "Phở Bò",
            "price": 55000,
            "category": "Soup",
            "description": "Traditional Vietnamese beef noodle soup with rice noodles, tender beef slices, and aromatic broth.",
            "image_url": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400",
            "stock_quantity": 50,
            "is_available": True,
        },
        {
            "name": "Bánh Mì",
            "price": 25000,
            "category": "Sandwich",
            "description": "Crispy baguette with pate, pickled vegetables, cilantro, and grilled pork.",
            "image_url": "https://images.unsplash.com/photo-1600454021747-59e0399f0d98?w=400",
            "stock_quantity": 30,
            "is_available": True,
        },
        {
            "name": "Bún Chả",
            "price": 60000,
            "category": "Main",
            "description": "Hanoi-style grilled pork with vermicelli noodles, fresh herbs, and dipping sauce.",
            "image_url": "https://images.unsplash.com/photo-1569058242567-93de6f36f8eb?w=400",
            "stock_quantity": 25,
            "is_available": True,
        },
        {
            "name": "Cơm Tấm",
            "price": 50000,
            "category": "Main",
            "description": "Broken rice with grilled pork chop, fried egg, and fish sauce.",
            "image_url": "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=400",
            "stock_quantity": 40,
            "is_available": True,
        },
        {
            "name": "Gỏi Cuốn",
            "price": 35000,
            "category": "Appetizer",
            "description": "Fresh spring rolls with shrimp, pork, rice noodles, and peanut dipping sauce.",
            "image_url": "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400",
            "stock_quantity": 20,
            "is_available": True,
        },
        {
            "name": "Cà Phê Sữa Đá",
            "price": 29000,
            "category": "Drinks",
            "description": "Vietnamese iced coffee with sweetened condensed milk.",
            "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400",
            "stock_quantity": 100,
            "is_available": True,
        },
        {
            "name": "Ốc Hương Xào Bơ Tỏi",
            "price": 120000,
            "category": "Seafood",
            "description": "Sweet snails stir-fried with garlic butter and lemongrass.",
            "image_url": "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400",
            "stock_quantity": 15,
            "is_available": True,
        },
        {
            "name": "Nem Nướng",
            "price": 45000,
            "category": "Appetizer",
            "description": "Grilled pork sausage served with rice paper, herbs, and dipping sauce.",
            "image_url": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400",
            "stock_quantity": 30,
            "is_available": True,
        },
        {
            "name": "Trà Đá",
            "price": 5000,
            "category": "Drinks",
            "description": "Iced Vietnamese green tea - free refills!",
            "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400",
            "stock_quantity": None,  # Unlimited
            "is_available": True,
        },
        {
            "name": "Chè Ba Màu",
            "price": 25000,
            "category": "Dessert",
            "description": "Three-color dessert with mung beans, red beans, and jelly in coconut milk.",
            "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400",
            "stock_quantity": 20,
            "is_available": True,
        },
    ]

    for food_data in foods:
        existing = db.query(Food).filter(Food.name == food_data["name"]).first()
        if not existing:
            food = Food(**food_data)
            db.add(food)
            print(f"Added: {food_data['name']}")
        else:
            print(f"Skipped (exists): {food_data['name']}")

    db.commit()


def seed_tables(db):
    """Seed sample tables."""
    for i in range(1, 11):  # Tables 1-10
        existing = db.query(Table).filter(Table.table_number == i).first()
        if not existing:
            table = Table(table_number=i, capacity=4, is_occupied=False)
            db.add(table)
            print(f"Added: Table {i}")
        else:
            print(f"Skipped (exists): Table {i}")

    db.commit()


def main():
    print("🌱 Seeding database...")
    db = SessionLocal()
    try:
        seed_foods(db)
        seed_tables(db)
        print("✅ Seeding complete!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
