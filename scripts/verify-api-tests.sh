#!/bin/bash
# Quick verification script for API endpoint tests
# Run this to verify the test suite is working correctly

set -e

echo "==================================="
echo "API Endpoint Test Verification"
echo "==================================="
echo ""

# Check if backend is running
echo "1. Checking backend connectivity..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend is not running"
    echo "   Start with: uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    exit 1
fi

# Check if frontend dependencies are installed
echo ""
echo "2. Checking frontend dependencies..."
if [ -d "frontend/node_modules" ]; then
    echo "   ✅ Frontend dependencies installed"
else
    echo "   ❌ Frontend dependencies not installed"
    echo "   Install with: cd frontend && npm install"
    exit 1
fi

# Run the API client unit tests (fast)
echo ""
echo "3. Running API client unit tests..."
cd frontend
npm test -- api-client.test.ts --silent 2>&1 | tail -n 10

# Run the endpoint integration tests
echo ""
echo "4. Running endpoint integration tests..."
echo "   This will test all 27 API endpoints..."
npm test -- api-endpoints.test.ts --silent 2>&1 | tail -n 20

echo ""
echo "==================================="
echo "✅ All API tests completed!"
echo "==================================="
echo ""
echo "Available test commands:"
echo "  npm run test:api           - Run all API tests"
echo "  npm run test:api:endpoints - Run endpoint tests only"
echo "  npm run test:api:client    - Run client config tests only"
echo "  npm run test:api:watch     - Run in watch mode"
echo ""
echo "Filter by category:"
echo "  TEST_CATEGORY=auth npm test -- api-endpoints.test.ts"
echo "  TEST_CATEGORY=orders npm test -- api-endpoints.test.ts"
echo ""
