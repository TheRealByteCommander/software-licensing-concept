using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

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
        using var response = await _http.PostAsJsonAsync(path, payload, ct);
        var envelope = await response.Content.ReadFromJsonAsync<TrpcEnvelope<T>>(cancellationToken: ct);

        if (!response.IsSuccessStatusCode || envelope?.Error is not null)
        {
            var err = envelope?.Error ?? new TrpcError("HTTP_ERROR", $"HTTP {(int)response.StatusCode}");
            throw new LicensingApiException(err.Code, err.Message, (int)response.StatusCode);
        }

        if (envelope?.Result?.Data is null)
            throw new LicensingApiException("BAD_RESPONSE", "Missing result.data", (int)response.StatusCode);

        return envelope.Result.Data;
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

public record ActivateResponse(bool Success, string Token, string Message);
public record DeactivateResponse(bool Success, string Message);
public record Initiate2FAResponse(bool Success, string ActivationToken, int ExpiresIn);
public record Confirm2FAResponse(bool Success, string Token, string Message);

public record ValidateResponse(
    bool Valid,
    LicenseData? License,
    string? Message
);

public record LicenseData(
    int ProductId,
    string Type,
    DateTimeOffset? ExpiresAt,
    List<string> Features
);

public sealed record TrpcEnvelope<T>(TrpcResult<T>? Result, TrpcError? Error);
public sealed record TrpcResult<T>(T? Data);
public sealed record TrpcError(string Code, string Message, object? Data = null);
