using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;

namespace ByteCommander.Licensing;

public sealed class LicenseClient
{
    private readonly HttpClient _http;

    public LicenseClient(HttpClient httpClient, string baseUrl)
    {
        _http = httpClient;
        _http.BaseAddress = new Uri(baseUrl.TrimEnd('/'));
    }

    public Task<ActivateResponse> ActivateAsync(ActivateRequest request, CancellationToken ct = default) =>
        PostAsync<ActivateResponse>("/api/trpc/api.activate", request, ct);

    public Task<ValidateResponse> ValidateAsync(ValidateRequest request, CancellationToken ct = default) =>
        PostAsync<ValidateResponse>("/api/trpc/api.validate", request, ct);

    public Task<DeactivateResponse> DeactivateAsync(DeactivateRequest request, CancellationToken ct = default) =>
        PostAsync<DeactivateResponse>("/api/trpc/api.deactivate", request, ct);

    public Task<Initiate2FAResponse> InitiateActivation2FAAsync(Initiate2FARequest request, CancellationToken ct = default) =>
        PostAsync<Initiate2FAResponse>("/api/trpc/twoFA.initiateActivation", request, ct);

    public Task<Confirm2FAResponse> ConfirmActivation2FAAsync(Confirm2FARequest request, CancellationToken ct = default) =>
        PostAsync<Confirm2FAResponse>("/api/trpc/twoFA.confirmActivationWith2FA", request, ct);

    private async Task<T> PostAsync<T>(string path, object payload, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync(path, new { json = payload }, ct);
        using var doc = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
        var root = doc.RootElement;

        if (root.TryGetProperty("error", out var errorElement))
        {
            var err = ParseError(errorElement);
            throw new LicensingApiException(err.Code, err.Message, (int)response.StatusCode);
        }

        if (!response.IsSuccessStatusCode)
            throw new LicensingApiException("HTTP_ERROR", $"HTTP {(int)response.StatusCode}", (int)response.StatusCode);

        if (!root.TryGetProperty("result", out var resultElement) ||
            !resultElement.TryGetProperty("data", out var dataElement))
        {
            throw new LicensingApiException("BAD_RESPONSE", "Missing result.data", (int)response.StatusCode);
        }

        var payloadElement = dataElement.TryGetProperty("json", out var jsonElement) ? jsonElement : dataElement;
        var data = payloadElement.Deserialize<T>();
        if (data is null)
            throw new LicensingApiException("BAD_RESPONSE", "Missing result payload", (int)response.StatusCode);

        return data;
    }

    private static (string Code, string Message) ParseError(JsonElement errorElement)
    {
        var payload = errorElement.TryGetProperty("json", out var jsonElement) ? jsonElement : errorElement;
        var message = payload.TryGetProperty("message", out var messageElement)
            ? messageElement.GetString() ?? "Licensing API error"
            : "Licensing API error";

        if (payload.TryGetProperty("data", out var dataElement) &&
            dataElement.TryGetProperty("code", out var codeElement))
        {
            return (codeElement.GetString() ?? "UNKNOWN", message);
        }

        if (payload.TryGetProperty("code", out var topLevelCode))
        {
            return (topLevelCode.ToString(), message);
        }

        return ("UNKNOWN", message);
    }
}

public sealed class LicensingApiException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }

    public LicensingApiException(string code, string message, int statusCode) : base(message)
    {
        Code = code;
        StatusCode = statusCode;
    }
}

public record ActivateRequest(string LicenseKey, string DeviceId, string? DeviceInfo = null);
public record ValidateRequest(string Token);
public record DeactivateRequest(string LicenseKey, string DeviceId);
public record Initiate2FARequest(string LicenseKey, string DeviceId, string? DeviceInfo = null);
public record Confirm2FARequest(string ActivationToken, string TotpCode);

public record ActivateResponse(
    bool Success,
    string Token,
    string Message,
    List<string>? Features = null,
    int? ProductId = null,
    int? OfflineGraceHours = null,
    string? OfflineUntil = null
);
public record DeactivateResponse(bool Success, string Message);
public record Initiate2FAResponse(bool Success, string ActivationToken, int ExpiresIn);
public record Confirm2FAResponse(
    bool Success,
    string Token,
    string Message,
    List<string>? Features = null,
    int? OfflineGraceHours = null,
    string? OfflineUntil = null
);

public record ValidateResponse(
    bool Valid,
    LicenseData? License,
    string? Message,
    string? Token = null
);

public record LicenseData(
    int ProductId,
    string Type,
    DateTimeOffset? ExpiresAt,
    List<string> Features,
    int? OfflineGraceHours = null,
    string? OfflineUntil = null
);
