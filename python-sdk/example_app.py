#!/usr/bin/env python3
"""
Example application demonstrating the Licensing SDK usage
"""

from licensing_sdk import LicenseClient
import sys


def main():
    # Configuration
    SERVER_URL = "<license-server-url>"  # Replace with your server URL
    PRODUCT_ID = 1  # Replace with your product ID
    
    print("=" * 60)
    print("Example Licensed Application")
    print("=" * 60)
    print()
    
    # Initialize the license client
    client = LicenseClient(
        server_url=SERVER_URL,
        product_id=PRODUCT_ID
    )
    
    # Check if already activated
    if client.is_valid(online=False):
        print("✓ License is already activated and valid")
        run_application(client)
        return
    
    # Need to activate
    print("License not found or invalid. Activation required.")
    license_key = input("Enter your license key: ").strip()
    
    if not license_key:
        print("Error: License key is required")
        sys.exit(1)
    
    try:
        print("\nActivating license...")
        result = client.activate(license_key)
        
        if result['success']:
            print(f"✓ {result['message']}")
            print()
            run_application(client)
        else:
            print(f"✗ Activation failed: {result.get('message', 'Unknown error')}")
            sys.exit(1)
    
    except Exception as e:
        print(f"✗ Error during activation: {e}")
        sys.exit(1)


def run_application(client: LicenseClient):
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
    print("APPLICATION IS RUNNING")
    print("-" * 60)
    print()
    print("Your licensed application logic would run here...")
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
