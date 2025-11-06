#!/usr/bin/env python3
"""
Example application demonstrating the Licensing SDK with 2FA support
"""

from licensing_sdk import LicenseClientWith2FA
import sys
import time


def main():
    # Configuration
    SERVER_URL = "https://your-license-server.com"  # Replace with your server URL
    PRODUCT_ID = 1  # Replace with your product ID
    
    print("=" * 60)
    print("Example Licensed Application with 2FA Support")
    print("=" * 60)
    print()
    
    # Initialize the license client with 2FA support
    client = LicenseClientWith2FA(
        server_url=SERVER_URL,
        product_id=PRODUCT_ID
    )
    
    # Check if already activated
    if client.is_valid(online=False):
        print("✓ License is already activated and valid")
        run_application(client)
        return
    
    # Need to activate
    print("License not found or invalid. 2FA Activation required.")
    license_key = input("Enter your license key: ").strip()
    
    if not license_key:
        print("Error: License key is required")
        sys.exit(1)
    
    try:
        print("\nInitiating 2FA activation...")
        initiate_result = client.initiate_activation_with_2fa(license_key)
        
        if not initiate_result['success']:
            print(f"✗ Activation initiation failed: {initiate_result.get('message')}")
            sys.exit(1)
        
        print(f"✓ {initiate_result['message']}")
        print(f"  (Token expires in {initiate_result['expiresIn']} seconds)")
        print()
        
        # Get TOTP code from user
        totp_code = input("Enter your 6-digit TOTP code from Google Authenticator: ").strip()
        
        if not totp_code or len(totp_code) != 6 or not totp_code.isdigit():
            print("Error: Please enter a valid 6-digit TOTP code")
            sys.exit(1)
        
        print("\nConfirming activation with 2FA code...")
        confirm_result = client.confirm_activation_with_2fa(
            initiate_result['activationToken'],
            totp_code
        )
        
        if confirm_result['success']:
            print(f"✓ {confirm_result['message']}")
            print()
            run_application(client)
        else:
            print(f"✗ 2FA confirmation failed: {confirm_result.get('message')}")
            sys.exit(1)
    
    except Exception as e:
        print(f"✗ Error during activation: {e}")
        sys.exit(1)


def run_application(client: LicenseClientWith2FA):
    """Main application logic - only runs if license is valid"""
    
    print("Starting application...")
    print()
    
    # Validate license (try online first, fallback to offline)
    validation = client.validate(online=True)
    
    if not validation['valid']:
        print(f"✗ License validation failed: {validation.get('message')}")
        sys.exit(1)
    
    print("✓ License validated successfully")
    
    if validation.get('offline'):
        print("  (Running in offline mode)")
    
    if 'license' in validation:
        license_info = validation['license']
        print(f"  Product ID: {license_info.get('productId')}")
        
        features = license_info.get('features', [])
        if features:
            print(f"  Enabled features: {', '.join(features)}")
    
    print()
    print("-" * 60)
    print("APPLICATION IS RUNNING (2FA VERIFIED)")
    print("-" * 60)
    print()
    print("Your licensed application logic would run here...")
    print("This application has been verified with 2FA authentication.")
    print()
    
    # Example: Check for specific features
    if 'license' in validation:
        features = validation['license'].get('features', [])
        
        if 'premium' in features:
            print("✓ Premium features enabled")
        
        if 'api_access' in features:
            print("✓ API access enabled")
    
    print()
    print("Application finished successfully.")


if __name__ == "__main__":
    main()
