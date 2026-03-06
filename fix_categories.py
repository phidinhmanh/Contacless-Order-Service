import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv('.env')
db_url = os.getenv('DATABASE_URL')
print(f'Connecting to: {db_url}')
engine = create_engine(db_url)

with engine.connect() as conn:
    # 1. Create categories if they don't exist
    categories = [
        ('Món chính', 'Main courses', 1),
        ('Đồ uống', 'Drinks and beverages', 2),
        ('Khai vị', 'Appetizers', 0),
        ('Hải sản', 'Seafood dishes', 3),
        ('Tráng miệng', 'Desserts', 4),
    ]

    print('Populating categories...')
    for name, desc, order in categories:
        exists = conn.execute(
            text('SELECT id FROM categories WHERE name = :name'), {'name': name}
        ).fetchone()
        if not exists:
            conn.execute(
                text(
                    'INSERT INTO categories (name, description, display_order) VALUES (:name, :desc, :order)'
                ),
                {'name': name, 'desc': desc, 'order': order},
            )
            print(f'Added category: {name}')

    # 2. Get category mapping
    cat_rows = conn.execute(text('SELECT id, name FROM categories')).fetchall()
    cat_map = {name: id for id, name in cat_rows}
    print(f'Category map: {cat_map}')

    # 3. Update foods based on their names (manual mapping for seeding)
    food_mapping = {
        'Phở Bò': 'Món chính',
        'Bánh Mì': 'Món chính',
        'Bún Chả': 'Món chính',
        'Cơm Tấm': 'Món chính',
        'Gỏi Cuốn': 'Khai vị',
        'Cà Phê Sữa Đá': 'Đồ uống',
        'Ốc Hương Xào Bơ Tỏi': 'Hải sản',
        'Nem Nướng': 'Khai vị',
        'Trà Đá': 'Đồ uống',
        'Chè Ba Màu': 'Tráng miệng',
    }

    print('Updating food categories...')
    for food_name, cat_name in food_mapping.items():
        cat_id = cat_map.get(cat_name)
        if cat_id:
            res = conn.execute(
                text('UPDATE foods SET category_id = :cat_id WHERE name = :name'),
                {'cat_id': cat_id, 'name': food_name},
            )
            print(f'Updated {food_name} to category {cat_name} (ID: {cat_id})')

    conn.commit()
    print('✅ Done!')
