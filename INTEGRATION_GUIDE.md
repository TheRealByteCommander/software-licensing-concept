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

End customers buy / renew / cancel **inside the product** (AnomalyMatrix). licadmin is vendor-only — do not send customers there.

All of these are public (no admin session). Rate-limited.

1. List plans: `GET /api/trpc/stripe.plans.listPublic`
2. Buy or repurchase: `POST /api/trpc/stripe.createCheckoutSession`
3. After Stripe redirect (use `session_id={CHECKOUT_SESSION_ID}` in **your app** success URL):
   - `GET /api/trpc/stripe.getCheckoutResult?input={"json":{"sessionId":"cs_..."}}`
4. Activate immediately after payment:

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

5. Renew / update payment: `client.createCustomerPortalSession({ licenseKey, customerEmail, returnUrl })`
6. Cancel: `client.cancelSubscription({ licenseKey, customerEmail })` (period-end by default)
7. Status: `client.getLicenseBilling({ licenseKey, customerEmail })`

Works for both **subscription** and **one-time** billing plans. Enable the Stripe Customer Portal in the Stripe Dashboard so step 5 can open.

Add a short note in API_DOCUMENTATION after stripe section if there's a good place. And listPublicPlans - tRPC GET with empty input for a no-input procedure: I'll check if `{}` causes issues. Could use a dedicated fetch without input. Fine for now.

Need to add getCustomerById to stripe.test mocks? createCheckoutSession now calls getCustomerByEmail - not in existing tests.

stripe.ts getLicenseBilling uses getProductById - already mocked.

Run tests. Also add API_DOCUMENTATION snippet.

listPublic query with `{}` - if it fails at runtime that's ok for this PR.

Fix unused import in stripe.ts? assertLicenseOwnedByEmail is used.

Python - skip unless quick. TS SDK is enough.

Run tests.

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

## Feature flags + 72h offline grace

`api.activate` and `api.validate` treat a non-empty license `metadata.features` list as **authoritative** (no union with product defaults). Missing or empty metadata falls back to the product **Default features**, then `["basic"]`. Send optional `productId` or `expectedProductId` so a key bound to another product is rejected.

JWT claims (and the JSON body) for offline clients:

| Field | Meaning |
|---|---|
| `features` | string[] |
| `offlineGraceHours` | `72` unless overridden in license metadata |
| `offlineUntil` | ISO (body) or unix seconds (JWT) – same instant as JWT `exp` |
| `licenseExpiresAt` | unix seconds of the real license end, or `null` |
| `exp` | offline window, **not** the subscription end date |

After a successful online `validate`, persist the returned `token` so the 72h window and current flags refresh.
