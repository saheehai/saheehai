"""Test environment.

Secrets must exist before `config` is imported, since it reads them at module
scope; setting them here keeps every test module from having to care.
"""

import os
import sys
from pathlib import Path

os.environ.setdefault("DEVICE_TOKEN_SECRET", "test-signing-key-not-a-real-secret")
os.environ.setdefault("TURNSTILE_SECRET", "test-turnstile-secret")
os.environ.setdefault("ALLOWED_ORIGIN", "https://saheeh.ai")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
