# .NET License Client (HttpClient-based)

Simple, dependency-light client for fast integration.

## Copy-paste usage

```csharp
using ByteCommander.Licensing;

var httpClient = new HttpClient();
var client = new LicenseClient(httpClient, "https://your-license-server.com");

var activation = await client.ActivateAsync(
    new ActivateRequest("XXXX-XXXX-XXXX-XXXX", "device-123")
);

var validation = await client.ValidateAsync(new ValidateRequest(activation.Token));
if (!validation.Valid)
{
    throw new Exception(validation.Message ?? "License invalid");
}

await client.DeactivateAsync(new DeactivateRequest("XXXX-XXXX-XXXX-XXXX", "device-123"));
```

## 2FA flow

```csharp
var init = await client.InitiateActivation2FAAsync(
    new Initiate2FARequest("XXXX-XXXX-XXXX-XXXX", "device-123")
);

var done = await client.ConfirmActivation2FAAsync(
    new Confirm2FARequest(init.ActivationToken, "123456")
);
```

## Error handling

```csharp
try
{
    await client.ActivateAsync(new ActivateRequest("...", "..."));
}
catch (LicensingApiException ex)
{
    Console.WriteLine($"[{ex.Code}] {ex.Message} (HTTP {ex.StatusCode})");
}
```
