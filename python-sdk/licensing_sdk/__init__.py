"""
Licensing SDK for Python
A simple client library for software license management
"""

from .client import LicenseClient
from .client_2fa import LicenseClientWith2FA

__version__ = "1.0.0"
__all__ = ["LicenseClient", "LicenseClientWith2FA"]
