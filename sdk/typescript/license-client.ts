export type LicenseType =
  | "subscription"
  | "perpetual"
  | "node_locked"
  | "user_based"
  | "feature_based";

export type ActivateRequest = {
  licenseKey: string;
  deviceId: string;
  deviceInfo?: string;
};

export type ValidateRequest = {
  token: string;
};

export type DeactivateRequest = {
  licenseKey: string;
  deviceId: string;
};

export type Initiate2FARequest = {
  licenseKey: string;
  deviceId: string;
  deviceInfo?: string;
};

export type Confirm2FARequest = {
  activationToken: string;
  totpCode: string;
};

export type ActivateResponse = {
  success: true;
  token: string;
  message: string;
};

export type ValidateResponse =
  | {
      valid: true;
      license: {
        productId: number;
        type: LicenseType;
        expiresAt: string | null;
        features: string[];
      };
    }
  | {
      valid: false;
      message: string;
    };

export type DeactivateResponse = {
  success: true;
  message: string;
};

export type Initiate2FAResponse = {
  success: true;
  activationToken: string;
  expiresIn: number;
};

export type Confirm2FAResponse = {
  success: true;
  token: string;
  message: string;
};

export type TrpcErrorPayload = {
  code: string;
  message: string;
  data?: unknown;
};

export class LicensingApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(payload: TrpcErrorPayload, status = 400) {
    super(payload.message || "Licensing API error");
    this.name = "LicensingApiError";
    this.code = payload.code || "UNKNOWN";
    this.status = status;
    this.details = payload.data;
  }
}

type TrpcEnvelope<T> = {
  result?: { data?: T | { json?: T } };
  error?: TrpcErrorPayload | { json?: TrpcErrorPayload & { data?: { code?: string } } };
};

function unwrapResultData<T>(data: T | { json?: T } | undefined): T | undefined {
  if (data && typeof data === "object" && "json" in data) {
    return (data as { json?: T }).json;
  }
  return data as T | undefined;
}

function unwrapErrorPayload(error: TrpcEnvelope<unknown>["error"]): TrpcErrorPayload {
  if (!error) {
    return { code: "UNKNOWN", message: "Licensing API error" };
  }

  const payload = (
    "json" in error && error.json ? error.json : error
  ) as TrpcErrorPayload & { data?: { code?: string } | unknown };

  const nestedCode =
    payload.data && typeof payload.data === "object" && "code" in payload.data
      ? String((payload.data as { code?: string }).code)
      : undefined;

  return {
    code: nestedCode || String(payload.code ?? "UNKNOWN"),
    message: payload.message || "Licensing API error",
    data: payload.data,
  };
}

export type LicenseClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

export class LicenseClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LicenseClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  activate(input: ActivateRequest): Promise<ActivateResponse> {
    return this.call<ActivateResponse>("/api/trpc/api.activate", input);
  }

  validate(input: ValidateRequest): Promise<ValidateResponse> {
    return this.call<ValidateResponse>("/api/trpc/api.validate", input);
  }

  deactivate(input: DeactivateRequest): Promise<DeactivateResponse> {
    return this.call<DeactivateResponse>("/api/trpc/api.deactivate", input);
  }

  initiateActivation2FA(input: Initiate2FARequest): Promise<Initiate2FAResponse> {
    return this.call<Initiate2FAResponse>("/api/trpc/twoFA.initiateActivation", input);
  }

  confirmActivation2FA(input: Confirm2FARequest): Promise<Confirm2FAResponse> {
    return this.call<Confirm2FAResponse>("/api/trpc/twoFA.confirmActivationWith2FA", input);
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: body }),
    });

    let parsed: TrpcEnvelope<T> | null = null;
    try {
      parsed = (await response.json()) as TrpcEnvelope<T>;
    } catch {
      throw new LicensingApiError({ code: "BAD_RESPONSE", message: "Invalid JSON response" }, response.status);
    }

    if (!response.ok || parsed?.error) {
      const payload = parsed?.error
        ? unwrapErrorPayload(parsed.error)
        : {
            code: "HTTP_ERROR",
            message: `HTTP ${response.status}`,
          };
      throw new LicensingApiError(payload, response.status);
    }

    const data = unwrapResultData(parsed?.result?.data);
    if (!data) {
      throw new LicensingApiError({ code: "BAD_RESPONSE", message: "Missing result.data payload" }, response.status);
    }

    return data;
  }
}
