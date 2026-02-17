import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv('.env')
db_url = os.getenv('DATABASE_URL')
print(f'Connecting to: {db_url}')
engine = create_engine(db_url)

with engine.connect() as conn:
    result = conn.execute(text('SELECT id, name, is_active FROM categories')).fetchall()
    print(f'Found {len(result)} categories:')
    for row in result:
        print(row)
