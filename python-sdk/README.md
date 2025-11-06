# Licensing SDK for Python

A simple and secure Python client library for integrating software license management into your applications.

## Features

- **Easy Integration**: Simple API for license activation and validation
- **Offline Support**: Validate licenses without internet connection (for up to 7 days)
- **Secure**: Uses JWT tokens with digital signatures
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Automatic Device Identification**: Generates unique device IDs automatically

## Installation

```bash
pip install licensing-sdk
```

Or install from source:

```bash
cd python-sdk
pip install -e .
```

## Quick Start

### Basic Usage

```python
from licensing_sdk import LicenseClient

# Initialize the client
client = LicenseClient(
    server_url="https://your-license-server.com",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX"
)

# Activate the license
result = client.activate()
if result['success']:
    print("License activated successfully!")
else:
    print(f"Activation failed: {result['message']}")

# Validate the license (online)
if client.is_valid():
    print("License is valid!")
    # Your application logic here
else:
    print("Invalid license")
    exit(1)
```

### Offline Validation

```python
# Validate without internet connection
if client.is_valid(online=False):
    print("License is valid (offline mode)")
else:
    print("License validation failed")
```

### Deactivation

```python
# Deactivate the license on this device
result = client.deactivate()
if result['success']:
    print("License deactivated successfully")
```

## Advanced Usage

### Detailed Validation

```python
# Get detailed validation information
result = client.validate(online=True)

if result['valid']:
    print("License is valid")
    if 'license' in result:
        print(f"Product ID: {result['license']['productId']}")
        print(f"Features: {result['license']['features']}")
else:
    print(f"Validation failed: {result['message']}")
```

### Custom Device Information

The SDK automatically generates a unique device ID based on system information. This ID is used to track activations and enforce device limits.

## API Reference

### LicenseClient

#### `__init__(server_url, product_id, license_key=None)`

Initialize the license client.

**Parameters:**
- `server_url` (str): Base URL of the license server
- `product_id` (int): Product ID from the license server
- `license_key` (str, optional): License key

#### `activate(license_key=None)`

Activate the license on this device.

**Returns:** dict with keys:
- `success` (bool): Whether activation succeeded
- `token` (str): License token (if successful)
- `message` (str): Status message

#### `validate(online=True)`

Validate the license.

**Parameters:**
- `online` (bool): If True, validate with server. If False, validate locally.

**Returns:** dict with keys:
- `valid` (bool): Whether license is valid
- `message` (str, optional): Error message if invalid
- `license` (dict, optional): License details if valid

#### `is_valid(online=True)`

Simple boolean check if license is valid.

**Returns:** bool

#### `deactivate()`

Deactivate the license on this device.

**Returns:** dict with success status

## Error Handling

```python
from licensing_sdk import LicenseClient

client = LicenseClient(
    server_url="https://your-license-server.com",
    product_id=1
)

try:
    result = client.activate("XXXX-XXXX-XXXX-XXXX")
    if not result['success']:
        print(f"Activation failed: {result['message']}")
except Exception as e:
    print(f"Error: {e}")
```

## License

MIT License
