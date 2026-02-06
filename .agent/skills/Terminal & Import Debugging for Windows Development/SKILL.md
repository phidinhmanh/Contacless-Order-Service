---
name: windows-debug
description: Diagnose and fix terminal, import, and database connection issues on Windows. Use when Python commands fail, imports cause errors, or SQLAlchemy can't connect to database.
---

# Windows Development Debugging

Windows has specific quirks that cause import errors, database connection issues, and terminal problems. This skill fixes them.

## When to use this skill

- Python imports fail with truncated errors
- SQLAlchemy import causes "Trace..." error
- Database connection errors on module import
- Terminal commands timeout or hang
- Tests fail with import errors but code runs fine

## Common Issues & Fixes

### 🔴 Issue 1: SQLAlchemy Import Fails

**Symptom:**
```bash
python -c "from app.models.payment import Payment"
# Output: Trace...emy'
# (Truncated error)
```

**Root Cause:** Database connection attempted during import (not lazy loading)

**Fix 1: Defer Database Connection**

```python
# ❌ BAD - Connects to DB on import
# app/core/database.py
from sqlalchemy import create_engine
from app.core.config import settings

# This runs immediately on import!
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# ✅ GOOD - Lazy connection
# app/core/database.py
from sqlalchemy import create_engine
from app.core.config import settings

_engine = None
_SessionLocal = None

def get_engine():
    """Lazy load database engine."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,  # Check connection before using
            echo=False
        )
    return _engine

def get_session_local():
    """Lazy load session factory."""
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine())
    return _SessionLocal

# Use in deps.py
def get_db():
    SessionLocal = get_session_local()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Fix 2: Check Database URL Format**

```python
# Windows PostgreSQL URL format issues
# ❌ WRONG
DATABASE_URL = "postgresql://user:pass@localhost/dbname"

# ✅ CORRECT for Windows
DATABASE_URL = "postgresql://user:pass@localhost:5432/dbname"

# ✅ CORRECT with psycopg2 driver explicitly
DATABASE_URL = "postgresql+psycopg2://user:pass@localhost:5432/dbname"

# Check in .env file
# Make sure no spaces around =
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/contactless_order
```

### 🔴 Issue 2: Import Circular Dependencies

**Symptom:**
```bash
from app.models.payment import Payment
# ImportError: cannot import name 'Order' from partially initialized module
```

**Diagnosis:**
```bash
# Check import chain
python -c "import sys; sys.path.insert(0, '.'); from app.models import payment"
```

**Fix: Break Circular Imports**

```python
# ❌ BAD - Circular import
# app/models/payment.py
from app.models.order import Order  # Imports at module level

class Payment(Base):
    order_id = Column(Integer, ForeignKey('orders.id'))
    order = relationship("Order", back_populates="payment")  # Order imports Payment

# ✅ GOOD - Use TYPE_CHECKING
# app/models/payment.py
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.order import Order  # Only for type hints

class Payment(Base):
    order_id = Column(Integer, ForeignKey('orders.id'))
    order: "Order" = relationship("Order", back_populates="payment")  # String reference
```

### 🔴 Issue 3: Windows Path Issues

**Symptom:**
```bash
python -c "from app.models.payment import Payment"
# ModuleNotFoundError: No module named 'app'
```

**Fix: Ensure PYTHONPATH is set**

```bash
# Option 1: Set PYTHONPATH temporarily
set PYTHONPATH=%CD%
python -c "from app.models.payment import Payment"

# Option 2: Add to Windows environment variables permanently
# 1. Search "Environment Variables" in Windows
# 2. Add PYTHONPATH = C:\path\to\your\project
# 3. Restart terminal

# Option 3: Run from project root
cd "D:\Work\project UET\Contacless Order Service"
python -c "from app.models.payment import Payment"
```

### 🔴 Issue 4: Database Not Running

**Symptom:**
```bash
python -c "from app.models.payment import Payment"
# psycopg2.OperationalError: could not connect to server
```

**Diagnosis:**

```bash
# Check if PostgreSQL is running
tasklist | findstr postgres

# Should see: postgres.exe

# If not running, start PostgreSQL service
net start postgresql-x64-15  # Adjust version number
```

**Fix: Start PostgreSQL**

```powershell
# PowerShell (Run as Administrator)
Start-Service -Name postgresql-x64-15

# Or use pgAdmin to start server
```

### 🔴 Issue 5: Virtual Environment Issues

**Symptom:**
```bash
python -c "import sqlalchemy"
# ModuleNotFoundError: No module named 'sqlalchemy'
```

**Fix: Activate Virtual Environment**

```bash
# Check if venv is activated
where python
# Should show: D:\Work\...\Contacless Order Service\.venv\Scripts\python.exe

# If not activated:
.venv\Scripts\activate

# Verify
python -c "import sqlalchemy; print('OK')"
```

## Diagnostic Workflow

### Step 1: Isolate the Problem

```bash
# Test 1: Basic Python works?
python -c "print('hello')"
# Expected: hello

# Test 2: Can import SQLAlchemy?
python -c "import sqlalchemy; print('SQLAlchemy OK')"
# Expected: SQLAlchemy OK

# Test 3: Can create engine without connecting?
python -c "from sqlalchemy import create_engine; print('Engine import OK')"
# Expected: Engine import OK

# Test 4: Can import Base?
python -c "from app.models.base import Base; print('Base OK')"
# Expected: Base OK

# Test 5: Can import models?
python -c "from app.models.payment import Payment; print('Payment OK')"
# Expected: Payment OK or error here
```

### Step 2: Check Database Connection

```bash
# Test connection string
python -c "from app.core.config import settings; print(settings.DATABASE_URL)"

# Should NOT contain passwords (masked)
# Should be: postgresql+psycopg2://user:***@localhost:5432/dbname

# Test actual connection
python -c "from app.core.database import engine; engine.connect(); print('Connected')"
```

### Step 3: Check Import Order

```python
# Create test file: test_imports.py
import sys
print("1. Starting imports")

print("2. Importing Base")
from app.models.base import Base

print("3. Importing User")
from app.models.user import User

print("4. Importing Food")
from app.models.food import Food

print("5. Importing Order")
from app.models.order import Order

print("6. Importing Payment")
from app.models.payment import Payment

print("All imports successful!")

# Run it
python test_imports.py
# See which step fails
```

### Step 4: Fix Database Connection in Models

```python
# If imports fail due to DB connection, modify models

# ❌ BAD - app/models/payment.py
from app.core.database import engine  # Connects immediately

# ✅ GOOD - Don't import engine in models
# Models should only define schema, not connect

# app/models/payment.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True)
    # ... rest of model
    
    # No database connection here!
```

## Quick Fixes for Common Errors

### Error: "ImportError: cannot import name X"

```bash
# 1. Check for typos
python -c "from app.models.payment import PaymentProvider; print(list(PaymentProvider))"

# 2. Check if enum is defined correctly
# app/models/payment.py
from enum import Enum

class PaymentProvider(str, Enum):  # Must inherit from str
    VIETQR = "vietqr"
    MOMO = "momo"
    VNPAY = "vnpay"
```

### Error: "ModuleNotFoundError: No module named 'app'"

```bash
# Run from project root
cd "D:\Work\project UET\Contacless Order Service"

# Add current directory to path
set PYTHONPATH=%CD%

# Or use -m flag
python -m pytest tests/
```

### Error: "psycopg2.OperationalError"

```bash
# 1. Check PostgreSQL is running
tasklist | findstr postgres

# 2. Check connection string
echo %DATABASE_URL%

# 3. Test connection manually
psql -U postgres -d contactless_order
# Enter password
# If connection works, issue is in Python

# 4. Check .env file is loaded
python -c "from app.core.config import settings; print(settings.DATABASE_URL)"
```

## Windows-Specific PowerShell Commands

```powershell
# Check if service is running
Get-Service postgresql*

# Start service
Start-Service postgresql-x64-15

# Restart service
Restart-Service postgresql-x64-15

# Check Python version
python --version

# Check installed packages
pip list | Select-String sqlalchemy

# Check virtual environment
Get-Command python | Select-Object Source
```

## Testing Import Issues

Create `diagnose.py` in project root:

```python
"""
Diagnostic script for import issues.
Run: python diagnose.py
"""

import sys
import os

print("=" * 60)
print("DIAGNOSTIC REPORT")
print("=" * 60)

# 1. Python version
print(f"\n1. Python version: {sys.version}")

# 2. Current directory
print(f"\n2. Current directory: {os.getcwd()}")

# 3. Python path
print(f"\n3. Python path:")
for path in sys.path:
    print(f"   - {path}")

# 4. Virtual environment
print(f"\n4. Virtual environment: {sys.prefix}")

# 5. Try imports
print(f"\n5. Testing imports:")

try:
    import sqlalchemy
    print(f"   ✅ SQLAlchemy: {sqlalchemy.__version__}")
except Exception as e:
    print(f"   ❌ SQLAlchemy: {e}")

try:
    from app.core.config import settings
    print(f"   ✅ Settings loaded")
    print(f"   ✅ DATABASE_URL: {settings.DATABASE_URL[:30]}...")  # Don't print password
except Exception as e:
    print(f"   ❌ Settings: {e}")

try:
    from app.models.base import Base
    print(f"   ✅ Base model imported")
except Exception as e:
    print(f"   ❌ Base model: {e}")

try:
    from app.models.payment import Payment, PaymentProvider
    print(f"   ✅ Payment model imported")
    print(f"   ✅ PaymentProvider enum: {list(PaymentProvider)}")
except Exception as e:
    print(f"   ❌ Payment model: {e}")

# 6. Test database connection
print(f"\n6. Testing database connection:")
try:
    from app.core.database import engine
    with engine.connect() as conn:
        result = conn.execute("SELECT 1")
        print(f"   ✅ Database connection successful")
except Exception as e:
    print(f"   ❌ Database connection: {e}")

print("\n" + "=" * 60)
print("END OF DIAGNOSTIC REPORT")
print("=" * 60)
```

Run it:
```bash
python diagnose.py
```

## Fix for Truncated Terminal Output

```bash
# If terminal truncates output, write to file
python -c "from app.models.payment import Payment" 2>&1 > error.txt
type error.txt

# Or use PowerShell
python -c "from app.models.payment import Payment" 2>&1 | Out-File -FilePath error.txt -Encoding utf8
Get-Content error.txt

# Increase buffer size (temporary)
mode con: cols=200 lines=500
```

## Running Tests with Import Issues

```bash
# Don't use -c for complex imports
# Use -m pytest instead

# ❌ BAD
python -c "from tests.test_payments import test_payment_init"

# ✅ GOOD
python -m pytest tests/test_payments.py::test_payment_init -v

# Run all tests
python -m pytest tests/ -v

# Run with verbose imports
python -m pytest tests/ -v --tb=short

# Run single test file
python -m pytest tests/test_payments.py -v
```

## Emergency Fix: Reset Everything

```bash
# 1. Deactivate venv
deactivate

# 2. Delete venv
rmdir /s .venv

# 3. Recreate venv
python -m venv .venv

# 4. Activate
.venv\Scripts\activate

# 5. Reinstall dependencies
pip install -r requirements.txt

# 6. Verify
python -c "import sqlalchemy; print('OK')"

# 7. Test imports
python diagnose.py
```

## Checklist Before Asking for Help

- [ ] Virtual environment is activated (`where python` shows `.venv`)
- [ ] PostgreSQL service is running (`tasklist | findstr postgres`)
- [ ] `.env` file exists and has correct `DATABASE_URL`
- [ ] Running from project root directory
- [ ] `PYTHONPATH` is set (if needed)
- [ ] Dependencies are installed (`pip list | findstr sqlalchemy`)
- [ ] No syntax errors in models (check with `python -m py_compile app/models/payment.py`)

---

**TOEIC Phrase**: "Systematic Diagnostic Procedures facilitate rapid Issue Resolution in Development Environments." (Các quy trình chẩn đoán có hệ thống tạo điều kiện giải quyết vấn đề nhanh chóng trong môi trường phát triển.)