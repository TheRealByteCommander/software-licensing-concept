# JS/TS License Client (lightweight)

Minimal typed client for fast integration.

## Copy-paste usage

```ts
import { LicenseClient } from "./sdk/typescript/license-client";

const client = new LicenseClient({
  baseUrl: "https://your-license-server.com",
});

const activation = await client.activate({
  licenseKey: "XXXX-XXXX-XXXX-XXXX",
  deviceId: "my-device-id",
  deviceInfo: JSON.stringify({ platform: "linux" }),
});

const validation = await client.validate({ token: activation.token });
if (!validation.valid) {
  throw new Error(validation.message);
}

await client.deactivate({
  licenseKey: "XXXX-XXXX-XXXX-XXXX",
  deviceId: "my-device-id",
});
```

## 2FA flow

```ts
const init = await client.initiateActivation2FA({
  licenseKey: "XXXX-XXXX-XXXX-XXXX",
  deviceId: "my-device-id",
});

const confirmed = await client.confirmActivation2FA({
  activationToken: init.activationToken,
  totpCode: "123456",
});
```

## Error handling

```ts
import { LicensingApiError } from "./sdk/typescript/license-client";

try {
  await client.activate({ licenseKey: "...", deviceId: "..." });
} catch (err) {
  if (err instanceof LicensingApiError) {
    console.error(err.code, err.message, err.status);
  }
}
```
