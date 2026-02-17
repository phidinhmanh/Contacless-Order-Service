import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app


def print_routes():
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', 'WS')
            print(f'{methods} {route.path}')


if __name__ == '__main__':
    print_routes()
