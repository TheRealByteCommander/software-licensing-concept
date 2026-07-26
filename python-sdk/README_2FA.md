# 2FA (Google Authenticator) Support

## Important: 2FA is Only for License Activation

**2FA is required ONLY when activating a license for the first time on a device.** When your program starts and validates an existing license, NO 2FA is needed.

### Activation Flow

**Without 2FA:**
1. Call `activate()` → License is immediately activated
2. Token is saved locally
3. On program startup, call `validate()` → No 2FA needed

**With 2FA:**
1. Call `initiate_activation_with_2fa()` → Get activation token (10 min expiry)
2. User enters TOTP code from Google Authenticator
3. Call `confirm_activation_with_2fa()` → License is activated
4. Token is saved locally
5. On program startup, call `validate()` → No 2FA needed

### Example: 2FA Activation

```python
from licensing_sdk import LicenseClientWith2FA

client = LicenseClientWith2FA(
    server_url="<license-server-url>",
    product_id=1
)

# Step 1: Initiate activation
result = client.initiate_activation_with_2fa("XXXX-XXXX-XXXX-XXXX")
if not result['success']:
    print(f"Failed: {result['message']}")
    exit(1)

# Step 2: Get TOTP code from user
totp_code = input("Enter 6-digit code from Google Authenticator: ")

# Step 3: Confirm with TOTP
confirm = client.confirm_activation_with_2fa(
    result['activationToken'],
    totp_code
)

if confirm['success']:
    print("License activated!")
else:
    print(f"Failed: {confirm['message']}")
    exit(1)

# Step 4: On program startup, just validate (no 2FA needed)
if client.is_valid():
    print("License is valid - running application")
else:
    print("License invalid")
    exit(1)
```

### Key Points

- **2FA is only for NEW activations** - not for validation
- **Token is cached locally** - subsequent program starts don't need 2FA
- **Activation token expires in 10 minutes** - user must complete 2FA within this time
- **Offline validation works** - program can validate license without internet for up to 7 days
