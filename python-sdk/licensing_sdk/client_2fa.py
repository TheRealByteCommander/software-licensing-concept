"""
License Client SDK with 2FA Support for Python Applications
Provides easy integration with the License Server API with Google Authenticator support
"""

import hashlib
import json
import os
import platform
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any


class LicenseClientWith2FA:
    """Client for license activation and validation with 2FA support"""
    
    def __init__(self, server_url: str, product_id: int, license_key: Optional[str] = None):
        """
        Initialize the license client with 2FA support
        
        Args:
            server_url: Base URL of the license server (e.g., 'https://license.example.com')
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
        system_info = f"{platform.node()}-{platform.machine()}-{platform.system()}"
        
        try:
            import uuid
            mac = uuid.getnode()
            system_info += f"-{mac}"
        except:
            pass
        
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
    
    def initiate_activation_with_2fa(self, license_key: Optional[str] = None) -> Dict[str, Any]:
        """
        Initiate license activation for 2FA-enabled products
        
        Args:
            license_key: License key to activate (uses instance key if not provided)
            
        Returns:
            dict: Response with 'success', 'activationToken', and 'expiresIn' keys
            
        Raises:
            Exception: If activation initiation fails
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
                f"{self.server_url}/api/trpc/twoFA.initiateActivation",
                json={
                    'licenseKey': key,
                    'deviceId': device_id,
                    'deviceInfo': device_info,
                }
            )
            response.raise_for_status()
            
            result = response.json()
            data = result.get('result', {}).get('data', {})
            
            if data.get('success'):
                return {
                    'success': True,
                    'activationToken': data['activationToken'],
                    'expiresIn': data['expiresIn'],
                    'message': 'Activation initiated. Please provide TOTP code to confirm.'
                }
            else:
                return {
                    'success': False,
                    'message': 'Activation initiation failed'
                }
        except requests.RequestException as e:
            raise Exception(f"Activation initiation request failed: {e}")
    
    def confirm_activation_with_2fa(self, activation_token: str, totp_code: str) -> Dict[str, Any]:
        """
        Confirm license activation with TOTP code
        
        Args:
            activation_token: Token from initiate_activation_with_2fa()
            totp_code: 6-digit TOTP code from Google Authenticator
            
        Returns:
            dict: Confirmation response with 'success', 'token', and 'message' keys
            
        Raises:
            Exception: If confirmation fails
        """
        try:
            response = requests.post(
                f"{self.server_url}/api/trpc/twoFA.confirmActivationWith2FA",
                json={
                    'activationToken': activation_token,
                    'totpCode': totp_code,
                }
            )
            response.raise_for_status()
            
            result = response.json()
            data = result.get('result', {}).get('data', {})
            
            if data.get('success'):
                token = data['token']
                self._token = token
                self._save_token(token)
                self.license_key = self.license_key or ""
                return {
                    'success': True,
                    'token': token,
                    'message': data.get('message', '2FA confirmation successful')
                }
            else:
                return {
                    'success': False,
                    'message': data.get('message', '2FA confirmation failed')
                }
        except requests.RequestException as e:
            raise Exception(f"2FA confirmation request failed: {e}")
    
    def activate_with_2fa(self, license_key: Optional[str], totp_code: str) -> Dict[str, Any]:
        """
        Complete 2FA activation flow in one call
        
        Args:
            license_key: License key to activate
            totp_code: 6-digit TOTP code from Google Authenticator
            
        Returns:
            dict: Activation response with 'success', 'token', and 'message' keys
        """
        # Step 1: Initiate activation
        initiate_result = self.initiate_activation_with_2fa(license_key)
        if not initiate_result['success']:
            return initiate_result
        
        activation_token = initiate_result['activationToken']
        
        # Step 2: Confirm with TOTP code
        confirm_result = self.confirm_activation_with_2fa(activation_token, totp_code)
        return confirm_result
    
    def validate(self, online: bool = True) -> Dict[str, Any]:
        """
        Validate the license
        
        Args:
            online: If True, validate with server. If False, validate locally (offline mode)
            
        Returns:
            dict: Validation response with 'valid' key and optional 'license' details
        """
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
                json={'token': self._token}
            )
            response.raise_for_status()
            
            result = response.json()
            return result.get('result', {}).get('data', {
                'valid': False,
                'message': 'Invalid response from server'
            })
        except requests.RequestException as e:
            print(f"Online validation failed, trying offline: {e}")
            return self._validate_offline()
    
    def _validate_offline(self) -> Dict[str, Any]:
        """Validate license token locally (without server connection)"""
        try:
            import jwt
            
            decoded = jwt.decode(self._token, options={"verify_signature": False})
            
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
                }
            }
        except Exception as e:
            return {
                'valid': False,
                'message': f'Offline validation failed: {e}'
            }
    
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
