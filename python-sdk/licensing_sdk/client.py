"""
License Client SDK for Python Applications
Provides easy integration with the License Server API
"""

import hashlib
import json
import os
import platform
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

from .trpc import raise_for_trpc_error, unwrap_result, wrap_input


class LicenseClient:
    """Client for license activation and validation"""
    
    def __init__(self, server_url: str, product_id: int, license_key: Optional[str] = None):
        """
        Initialize the license client
        
        Args:
            server_url: Base URL of the license server (e.g., 'http://localhost:3000')
            product_id: Product ID from the license server
            license_key: License key (optional, can be set later)
        """
        self.server_url = server_url.rstrip('/')
        self.product_id = product_id
        self.license_key = license_key
        self._token: Optional[str] = None
        self._token_file = self._get_token_file_path()
        
    def _get_token_file_path(self) -> Path:
        """Get the path to store the license token"""
        if platform.system() == "Windows":
            app_data = os.getenv("APPDATA", "")
            base_dir = Path(app_data) / "LicenseSDK"
        else:
            base_dir = Path.home() / ".license_sdk"
        
        base_dir.mkdir(parents=True, exist_ok=True)
        return base_dir / f"license_{self.product_id}.token"
    
    def _get_device_id(self) -> str:
        """Generate a unique device identifier"""
        # Combine multiple system identifiers
        system_info = f"{platform.node()}-{platform.machine()}-{platform.system()}"
        
        # Try to get MAC address
        try:
            import uuid
            mac = uuid.getnode()
            system_info += f"-{mac}"
        except:
            pass
        
        # Create a hash
        return hashlib.sha256(system_info.encode()).hexdigest()
    
    def _save_token(self, token: str) -> None:
        """Save the license token to disk"""
        try:
            with open(self._token_file, 'w') as f:
                json.dump({
                    'token': token,
                    'saved_at': datetime.now().isoformat()
                }, f)
        except Exception as e:
            print(f"Warning: Could not save token: {e}")
    
    def _load_token(self) -> Optional[str]:
        """Load the license token from disk"""
        try:
            if self._token_file.exists():
                with open(self._token_file, 'r') as f:
                    data = json.load(f)
                    return data.get('token')
        except Exception as e:
            print(f"Warning: Could not load token: {e}")
        return None
    
    def activate(self, license_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Activate the license on this device
        
        Note: If the product requires 2FA, use LicenseClientWith2FA instead.
        
        Args:
            license_key: License key to activate (uses instance key if not provided)
            
        Returns:
            dict: Activation response with 'success', 'token', and 'message' keys
            
        Raises:
            Exception: If activation fails or 2FA is required
        """
        key = license_key or self.license_key
        if not key:
            raise ValueError("License key is required for activation")
        
        device_id = self._get_device_id()
        device_info = json.dumps({
            'platform': platform.system(),
            'platform_version': platform.version(),
            'machine': platform.machine(),
            'hostname': platform.node(),
        })
        
        try:
            response = requests.post(
                f"{self.server_url}/api/trpc/api.activate",
                json=wrap_input({
                    'licenseKey': key,
                    'deviceId': device_id,
                    'deviceInfo': device_info,
                })
            )
            response.raise_for_status()

            result = response.json()
            raise_for_trpc_error(result, response.ok)
            data = unwrap_result(result)
            if data.get('success'):
                token = data['token']
                self._token = token
                self._save_token(token)
                self.license_key = key
                return {
                    'success': True,
                    'token': token,
                    'message': data.get('message', 'Activation successful'),
                    'features': data.get('features', []),
                    'productId': data.get('productId'),
                    'offlineGraceHours': data.get('offlineGraceHours'),
                    'offlineUntil': data.get('offlineUntil'),
                }
            else:
                return {
                    'success': False,
                    'message': 'Activation failed'
                }
        except requests.RequestException as e:
            raise Exception(f"Activation request failed: {e}")
    
    def validate(self, online: bool = True) -> Dict[str, Any]:
        """
        Validate the license
        
        Args:
            online: If True, validate with server. If False, validate locally (offline mode)
            
        Returns:
            dict: Validation response with 'valid' key and optional 'license' details
        """
        # Load token if not in memory
        if not self._token:
            self._token = self._load_token()
        
        if not self._token:
            return {
                'valid': False,
                'message': 'No license token found. Please activate first.'
            }
        
        if online:
            return self._validate_online()
        else:
            return self._validate_offline()
    
    def _validate_online(self) -> Dict[str, Any]:
        """Validate license with the server"""
        try:
            response = requests.post(
                f"{self.server_url}/api/trpc/api.validate",
                json=wrap_input({'token': self._token})
            )
            response.raise_for_status()

            result = response.json()
            raise_for_trpc_error(result, response.ok)
            data = unwrap_result(result)
            if data and data.get("valid") and data.get("token"):
                self._token = data["token"]
                self._save_token(data["token"])
            return data or {
                'valid': False,
                'message': 'Invalid response from server'
            }
        except requests.RequestException as e:
            # If online validation fails, try offline
            print(f"Online validation failed, trying offline: {e}")
            return self._validate_offline()
    
    def _validate_offline(self) -> Dict[str, Any]:
        """Validate license token locally (without server connection)"""
        try:
            import jwt
            
            # Decode without verification (we can't verify signature offline)
            # In production, you should verify the signature with the public key
            decoded = jwt.decode(self._token, options={"verify_signature": False})
            
            # Check expiration
            exp = decoded.get('exp')
            if exp and datetime.fromtimestamp(exp) < datetime.now():
                return {
                    'valid': False,
                    'message': 'License token has expired. Please connect to the internet to renew.'
                }
            
            return {
                'valid': True,
                'offline': True,
                'license': {
                    'productId': decoded.get('productId'),
                    'features': decoded.get('features', []),
                    'offlineGraceHours': decoded.get('offlineGraceHours'),
                    'offlineUntil': decoded.get('offlineUntil'),
                    'licenseExpiresAt': decoded.get('licenseExpiresAt'),
                }
            }
        except Exception as e:
            return {
                'valid': False,
                'message': f'Offline validation failed: {e}'
            }
    
    def deactivate(self) -> Dict[str, Any]:
        """
        Deactivate the license on this device
        
        Returns:
            dict: Deactivation response
        """
        if not self.license_key:
            raise ValueError("License key is required for deactivation")
        
        device_id = self._get_device_id()
        
        try:
            response = requests.post(
                f"{self.server_url}/api/trpc/api.deactivate",
                json=wrap_input({
                    'licenseKey': self.license_key,
                    'deviceId': device_id,
                })
            )
            response.raise_for_status()

            # Clear local token
            self._token = None
            if self._token_file.exists():
                self._token_file.unlink()

            result = response.json()
            raise_for_trpc_error(result, response.ok)
            data = unwrap_result(result)
            return data or {
                'success': False,
                'message': 'Deactivation failed'
            }
        except requests.RequestException as e:
            raise Exception(f"Deactivation request failed: {e}")
    
    def is_valid(self, online: bool = True) -> bool:
        """
        Simple boolean check if license is valid
        
        Args:
            online: If True, validate with server. If False, validate locally
            
        Returns:
            bool: True if license is valid, False otherwise
        """
        result = self.validate(online=online)
        return result.get('valid', False)
