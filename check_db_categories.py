import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv('.env')
db_url = os.getenv('DATABASE_URL')
print(f'Connecting to: {db_url}')
engine = create_engine(db_url)

with engine.connect() as conn:
    print('\n--- CATEGORIES ---')
    cats = conn.execute(text('SELECT id, name, is_active FROM categories')).fetchall()
    print(f'Found {len(cats)} categories:')
    for row in cats:
        print(row)

    print('\n--- FOODS CATEGORY STATUS ---')
    foods = conn.execute(text('SELECT id, name, category_id FROM foods')).fetchall()
    print(f'Total foods: {len(foods)}')
    null_cats = [f for f in foods if f[2] is None]
    print(f'Foods with category_id=NULL: {len(null_cats)}')
    distinct_ids = sorted(list(set([f[2] for f in foods if f[2] is not None])))
    print(f'Distinct category_ids in foods: {distinct_ids}')
