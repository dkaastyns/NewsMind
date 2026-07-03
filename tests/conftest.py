# conftest.py — pytest configuration for NewsMind bug exploration tests
import sys
import os

# Make sure workspace root modules are importable
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, WORKSPACE_ROOT)
