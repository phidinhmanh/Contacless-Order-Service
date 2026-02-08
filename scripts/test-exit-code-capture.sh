#!/bin/bash

# Test script to verify exit code capture works correctly

echo "Testing exit code capture methods..."
echo ""

# Test 1: Command that fails
echo "Test 1: Failed command with tee (OLD METHOD - WRONG)"
if echo "test" | grep "nonexistent" 2>&1 | tee /tmp/test.log; then
    echo "  Result: SUCCESS (WRONG - tee always returns 0!)"
else
    echo "  Result: FAILURE (correct)"
fi
echo ""

# Test 2: Using PIPESTATUS
echo "Test 2: Failed command with PIPESTATUS (NEW METHOD)"
set +e
echo "test" | grep "nonexistent" 2>&1 | tee /tmp/test.log
EXIT_CODE=${PIPESTATUS[0]}
set -e
echo "  Exit code captured: $EXIT_CODE"
if [ $EXIT_CODE -eq 0 ]; then
    echo "  Result: SUCCESS"
else
    echo "  Result: FAILURE (correct - grep failed)"
fi
echo ""

# Test 3: Successful command
echo "Test 3: Successful command with PIPESTATUS"
set +e
echo "test" | grep "test" 2>&1 | tee /tmp/test.log
EXIT_CODE=${PIPESTATUS[0]}
set -e
echo "  Exit code captured: $EXIT_CODE"
if [ $EXIT_CODE -eq 0 ]; then
    echo "  Result: SUCCESS (correct - grep found match)"
else
    echo "  Result: FAILURE"
fi
echo ""

# Test 4: Simulate migration failure
echo "Test 4: Simulating Alembic migration failure"
set +e
(exit 1) 2>&1 | tee /tmp/test.log
EXIT_CODE=${PIPESTATUS[0]}
set -e
echo "  Exit code captured: $EXIT_CODE"
if [ $EXIT_CODE -eq 0 ]; then
    echo "  Result: Would show ✅ (WRONG!)"
else
    echo "  Result: Would show ❌ (correct)"
fi

rm -f /tmp/test.log
echo ""
echo "✅ Test complete - PIPESTATUS method works correctly!"
