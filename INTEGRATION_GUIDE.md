# Integration Guide (Python / Node / .NET)

Minimal copy-paste steps for production integration.

## 0) API Contract (v1)

- Versioned spec: `api/openapi.v1.yaml`
- Covered endpoints:
  - `POST /api/trpc/api.activate`
  - `POST /api/trpc/api.validate`
  - `POST /api/trpc/api.deactivate`
  - `POST /api/trpc/twoFA.initiateActivation`
  - `POST /api/trpc/twoFA.confirmActivationWith2FA`
- Unified error contract: `error.code`, `error.message`, optional `error.data`
- **Wire format:** The server uses tRPC with `superjson`. Send request bodies as `{"json": {...payload}}` and read successful payloads from `result.data.json` (SDKs handle this automatically).

---

## Python (existing SDK)

1. Install:

```bash
cd python-sdk
pip install -e .
```

2. Use:

```python
from licensing_sdk import LicenseClient

client = LicenseClient(
    server_url="<license-server-url>",
    product_id=1,
    license_key="XXXX-XXXX-XXXX-XXXX"
)

activation = client.activate()
validation = client.validate(online=True)
```

3. 2FA products:

```python
from licensing_sdk import LicenseClientWith2FA
```

(Complete 2FA example: `python-sdk/README_2FA.md`)

---

## Stripe purchase + immediate activation

1. List plans: `GET /api/trpc/stripe.plans.listPublic`
2. Start checkout: `POST /api/trpc/stripe.createCheckoutSession`
3. After Stripe redirect (use `session_id={CHECKOUT_SESSION_ID}` in success URL):
   - `GET /api/trpc/stripe.getCheckoutResult?input={"json":{"sessionId":"cs_..."}}`
4. Activate immediately:

```ts
const purchase = await client.getCheckoutResult({ sessionId });
if (!purchase.readyToActivate || !purchase.licenseKey) {
  throw new Error("License not ready yet");
}

const activation = await client.activate({
  licenseKey: purchase.licenseKey,
  deviceId: "device-123",
});
```

Works for both **subscription** and **one-time** billing plans.

---

## Node / TypeScript (new lightweight module)

1. Copy/import `sdk/typescript/license-client.ts`.

2. Use:

```ts
import { LicenseClient } from "./sdk/typescript/license-client";

const client = new LicenseClient({ baseUrl: "<license-server-url>" });

const activation = await client.activate({
  licenseKey: "XXXX-XXXX-XXXX-XXXX",
  deviceId: "device-123",
});

const validation = await client.validate({ token: activation.token });
if (!validation.valid) throw new Error(validation.message);
```

3. 2FA flow (if required):

```ts
const init = await client.initiateActivation2FA({ licenseKey: "...", deviceId: "..." });
const done = await client.confirmActivation2FA({ activationToken: init.activationToken, totpCode: "123456" });
```

---

## .NET / C# (new HttpClient module)

1. Copy `sdk/dotnet/LicenseClient.cs` into your project.

2. Use:

```csharp
using ByteCommander.Licensing;

var client = new LicenseClient(new HttpClient(), "<license-server-url>");
var activation = await client.ActivateAsync(new ActivateRequest("XXXX-XXXX-XXXX-XXXX", "device-123"));
var validation = await client.ValidateAsync(new ValidateRequest(activation.Token));
```

3. Handle API errors:

```csharp
catch (LicensingApiException ex)
{
    Console.WriteLine($"[{ex.Code}] {ex.Message}");
}
```

---

## End-user & admin guides

- **Software users:** [docs/ANLEITUNG_SOFTWARENUTZER.md](../docs/ANLEITUNG_SOFTWARENUTZER.md)
- **License admins:** [docs/ANLEITUNG_LIZENZADMIN.md](../docs/ANLEITUNG_LIZENZADMIN.md)

---

- Store license token securely (OS keychain/secure storage preferred)
- Use stable `deviceId` generation
- Retry transient network errors (with backoff)
- Log `error.code` for support diagnostics
- Keep API contract pinned to `openapi.v1.yaml`
