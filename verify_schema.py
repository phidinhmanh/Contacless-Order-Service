import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

load_dotenv('.env')
DATABASE_URL = os.getenv('DATABASE_URL')
engine = create_engine(DATABASE_URL)
inspector = inspect(engine)


def check_table(table_name, columns_to_check):
    print(f'\n--- Checking table: {table_name} ---')
    columns = inspector.get_columns(table_name)
    for col in columns:
        if col['name'] in columns_to_check:
            print(f'Column: {col["name"]}')
            print(f'  Nullable: {col["nullable"]}')
            print(f'  Default: {col["default"]}')
            print(f'  Server Default: {col.get("server_default")}')


check_table('categories', ['is_active'])
check_table('foods', ['is_out_of_stock'])
check_table('orders', ['status'])
