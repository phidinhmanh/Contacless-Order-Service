"""
Main entry point for the application.
Redirects to app.main.
"""

import os

import uvicorn

if __name__ == '__main__':
    HOST = os.getenv('HOST', '127.0.0.1')
    PORT = os.getenv('PORT', 8000)
    uvicorn.run('app.main:app', host=HOST, port=PORT, reload=True)
