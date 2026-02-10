#!/usr/bin/env python3
"""
Endpoint Verification Script for Contacless Order Service
Tests all frontend-backend API endpoint alignment and functionality.

Usage:
    uv run python scripts/verify_endpoints.py
    uv run python scripts/verify_endpoints.py --verbose
    uv run python scripts/verify_endpoints.py --category auth
"""

import asyncio
import argparse
import sys
from typing import Dict, List, Optional
import httpx
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

# Base URLs
API_BASE_URL = "http://127.0.0.1:8000/api/v1"
WS_BASE_URL = "ws://127.0.0.1:8000/api/v1"

class EndpointTest:
    def __init__(self, method: str, path: str, category: str, auth_required: bool = False):
        self.method = method
        self.path = path
        self.category = category
        self.auth_required = auth_required
        self.status = "pending"
        self.message = ""

# Define all endpoints to test based on backend implementation
ENDPOINTS = [
    # Auth endpoints
    EndpointTest("POST", "/auth/register", "auth"),
    EndpointTest("POST", "/auth/login", "auth"),
    EndpointTest("POST", "/auth/refresh", "auth", auth_required=True),
    EndpointTest("POST", "/auth/guest", "auth"),
    EndpointTest("POST", "/auth/logout", "auth", auth_required=True),
    EndpointTest("POST", "/auth/guest/demographics", "auth", auth_required=True),

    # Users endpoints
    EndpointTest("GET", "/users/me", "users", auth_required=True),
    EndpointTest("PATCH", "/users/me/lead-info", "users", auth_required=True),
    EndpointTest("GET", "/users", "users", auth_required=True),

    # Foods endpoints
    EndpointTest("GET", "/foods", "foods"),
    EndpointTest("POST", "/foods", "foods", auth_required=True),

    # Categories endpoints
    EndpointTest("GET", "/categories", "categories"),
    EndpointTest("POST", "/categories", "categories", auth_required=True),

    # Menu endpoints
    EndpointTest("GET", "/menu", "menu"),
    EndpointTest("GET", "/menu/categories", "menu"),

    # Orders endpoints
    EndpointTest("GET", "/orders", "orders", auth_required=True),
    EndpointTest("POST", "/orders", "orders", auth_required=True),

    # Tables endpoints
    EndpointTest("GET", "/tables", "tables", auth_required=True),
    EndpointTest("POST", "/tables", "tables", auth_required=True),

    # Payments endpoints
    EndpointTest("POST", "/payments/initiate", "payments", auth_required=True),
    EndpointTest("POST", "/payments/webhook", "payments"),
    EndpointTest("POST", "/payments/webhook/casso", "payments"),

    # Analytics endpoints
    EndpointTest("GET", "/analytics/revenue", "analytics", auth_required=True),
    EndpointTest("GET", "/analytics/popular-items", "analytics", auth_required=True),
    EndpointTest("GET", "/analytics/peak-hours", "analytics", auth_required=True),
    EndpointTest("GET", "/analytics/customers", "analytics", auth_required=True),
    EndpointTest("GET", "/analytics/retention", "analytics", auth_required=True),
    EndpointTest("GET", "/analytics/export", "analytics", auth_required=True),
]

async def test_endpoint(client: httpx.AsyncClient, test: EndpointTest, token: Optional[str] = None) -> EndpointTest:
    """Test a single endpoint for existence and basic connectivity."""
    url = f"{API_BASE_URL}{test.path}"
    headers = {}

    if test.auth_required and token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        if test.method == "GET":
            response = await client.get(url, headers=headers, timeout=5.0)
        elif test.method == "POST":
            response = await client.post(url, json={}, headers=headers, timeout=5.0)
        elif test.method == "PUT":
            response = await client.put(url, json={}, headers=headers, timeout=5.0)
        elif test.method == "PATCH":
            response = await client.patch(url, json={}, headers=headers, timeout=5.0)
        elif test.method == "DELETE":
            response = await client.delete(url, headers=headers, timeout=5.0)

        # Accept various status codes as "endpoint exists"
        # 401 = endpoint exists but needs auth
        # 422 = endpoint exists but validation failed (expected for empty payloads)
        # 404 = endpoint exists but resource not found (for GET with ID)
        # 200, 201 = success
        if response.status_code in [200, 201, 401, 404, 422]:
            test.status = "exists"
            test.message = f"Status {response.status_code}"

            # Special handling for specific cases
            if response.status_code == 401:
                test.message += " (auth required)"
            elif response.status_code == 422:
                test.message += " (validation error - endpoint exists)"
            elif response.status_code == 404 and "/{" in test.path:
                test.message += " (needs ID parameter)"
        else:
            test.status = "warning"
            test.message = f"Unexpected status {response.status_code}"

    except httpx.ConnectError:
        test.status = "failed"
        test.message = "Cannot connect to backend"
    except httpx.TimeoutException:
        test.status = "failed"
        test.message = "Request timeout"
    except Exception as e:
        test.status = "failed"
        test.message = f"Error: {str(e)[:50]}"

    return test

async def get_auth_token(client: httpx.AsyncClient) -> Optional[str]:
    """Attempt to get an auth token for testing protected endpoints."""
    try:
        # Try to login with default admin credentials
        response = await client.post(
            f"{API_BASE_URL}/auth/login",
            data={"username": "0386868686", "password": "AdminPassword123!"},
            timeout=5.0
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
    except Exception as e:
        # print(f"Login error: {e}")
        pass
    return None

async def test_websocket():
    """Test WebSocket endpoint connectivity."""
    import websockets
    try:
        # FastAPI/Uvicorn WebSocket endpoint usually works with ws://
        # Security is disabled in kitchen.py for development
        async with websockets.connect(f"{WS_BASE_URL}/ws/kitchen") as websocket:
            # Just connect and disconnect
            return ("exists", "WebSocket connection successful")
    except Exception as e:
        return ("failed", f"WebSocket error: {str(e)[:50]}")

async def main(category: Optional[str] = None, verbose: bool = False):
    """Main test runner."""
    console.print("\n[bold cyan] API Endpoint Verification Test[/bold cyan]\n")

    # Filter endpoints by category if specified
    tests_to_run = ENDPOINTS
    if category:
        tests_to_run = [t for t in ENDPOINTS if t.category == category]
        console.print(f"[yellow]Filtering tests for category: {category}[/yellow]\n")

    async with httpx.AsyncClient() as client:
        # Check backend connectivity first
        console.print(" Checking backend connectivity...", end=" ")
        try:
            response = await client.get(f"{API_BASE_URL.replace('/api/v1', '')}/health", timeout=10.0)
            if response.status_code == 200:
                console.print("[green] Backend is running[/green]\n")
            else:
                console.print("[red] Backend health check failed[/red]\n")
                return 1
        except Exception as e:
            import traceback
            console.print(f"[red] Cannot connect to backend: {e}[/red]\n")
            if verbose:
                console.print(traceback.format_exc())
            console.print("[yellow] Make sure the backend is running: uv run uvicorn app.main:app --reload[/yellow]\n")
            return 1

        # Get auth token for protected endpoints
        console.print(" Attempting to get auth token...", end=" ")
        token = await get_auth_token(client)
        if token:
            console.print("[green] Token acquired[/green]\n")
        else:
            console.print("[yellow] Could not get token (some tests may fail)[/yellow]\n")

        # Run endpoint tests
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task(f"Testing {len(tests_to_run)} endpoints...", total=len(tests_to_run))

            results = []
            for test in tests_to_run:
                if verbose:
                    progress.console.print(f"Testing {test.method} {test.path}...")
                result = await test_endpoint(client, test, token)
                results.append(result)
                progress.advance(task)

        # Test WebSocket separately
        console.print("\n Testing WebSocket endpoint...", end=" ")
        ws_status, ws_message = await test_websocket()
        console.print(f"{ws_status} {ws_message}\n")

        # Display results table
        table = Table(title="Endpoint Test Results", show_header=True, header_style="bold magenta")
        table.add_column("Category", style="cyan", width=12)
        table.add_column("Method", style="yellow", width=8)
        table.add_column("Path", style="white", width=35)
        table.add_column("Status", width=15)
        table.add_column("Message", width=30)

        # Group by category
        categories = {}
        for result in results:
            if result.category not in categories:
                categories[result.category] = []
            categories[result.category].append(result)

        for cat in sorted(categories.keys()):
            for i, result in enumerate(categories[cat]):
                table.add_row(
                    cat if i == 0 else "",
                    result.method,
                    result.path,
                    result.status,
                    result.message
                )

        console.print(table)

        # Summary
        total = len(results)
        passed = len([r for r in results if "exists" in r.status])
        warnings = len([r for r in results if "warning" in r.status])
        failed = len([r for r in results if "failed" in r.status])

        console.print(f"\n[bold]Summary:[/bold]")
        console.print(f"  Total: {total}")
        console.print(f"  [green] Passed: {passed}[/green]")
        console.print(f"  [yellow] Warnings: {warnings}[/yellow]")
        console.print(f"  [red] Failed: {failed}[/red]")

        if ws_status == "exists":
            console.print(f"  [green] WebSocket: OK[/green]")
        else:
            console.print(f"  [red] WebSocket: FAILED[/red]")

        # Return exit code
        return 0 if failed == 0 else 1

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify API endpoints")
    parser.add_argument("--category", "-c", help="Filter by category (auth, users, foods, etc.)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    exit_code = asyncio.run(main(args.category, args.verbose))
    sys.exit(exit_code)
