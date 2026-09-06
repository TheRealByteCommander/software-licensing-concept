import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_LOGO, APP_TITLE, getOAuthPortalUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Copy, Loader2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Step = "credentials" | "totp" | "setup" | "enroll";

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading, isAuthenticated, refresh } = useAuth();
  const utils = trpc.useUtils();
  const statusQuery = trpc.auth.localStatus.useQuery();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [enrollmentToken, setEnrollmentToken] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.localLogin.useMutation();
  const verifyMutation = trpc.auth.localVerifyTotp.useMutation();
  const setupStartMutation = trpc.auth.localSetupStart.useMutation();
  const setupConfirmMutation = trpc.auth.localSetupConfirm.useMutation();

  useEffect(() => {
    if (!statusQuery.data) return;
    if (!statusQuery.data.localAuthEnabled) {
      const oauthUrl = getOAuthPortalUrl();
      if (oauthUrl) {
        window.location.href = oauthUrl;
      }
      return;
    }
    if (statusQuery.data.setupRequired && step === "credentials") {
      setStep("setup");
    }
    if (!statusQuery.data.setupRequired && step === "setup") {
      setStep("credentials");
    }
  }, [statusQuery.data, step]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, user, setLocation]);

  const busy =
    loginMutation.isPending ||
    verifyMutation.isPending ||
    setupStartMutation.isPending ||
    setupConfirmMutation.isPending;

  const finishAuthenticated = async () => {
    await utils.auth.me.invalidate();
    await refresh();
    setLocation("/");
  };

  const onCredentialsSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await loginMutation.mutateAsync({ identifier, password });
      setPendingToken(result.pendingToken);
      setTotpCode("");
      setStep("totp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const onTotpSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await verifyMutation.mutateAsync({ pendingToken, totpCode });
      await finishAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    }
  };

  const onSetupSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const result = await setupStartMutation.mutateAsync({
        password,
        confirmPassword,
        setupToken: setupToken || undefined,
      });
      setEnrollmentToken(result.enrollmentToken);
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setTotpCode("");
      setStep("enroll");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
    }
  };

  const onEnrollSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await setupConfirmMutation.mutateAsync({ enrollmentToken, totpCode });
      await finishAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    }
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    toast.success("TOTP secret copied");
  };

  if (authLoading || statusQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!statusQuery.data?.localAuthEnabled && !getOAuthPortalUrl()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Authentication is not configured</CardTitle>
            <CardDescription>
              Set LOCAL_AUTH_ENABLED=true for self-hosted login, or configure BC OAuth.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <img src={APP_LOGO} alt={APP_TITLE} className="h-16 w-16 rounded-xl object-cover shadow" />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Byte Commander</h1>
            <p className="text-sm text-muted-foreground">License Server Administration</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === "setup" || step === "enroll" ? "First-time admin setup" : "Admin sign in"}
            </CardTitle>
            <CardDescription>
              {step === "totp" && "Enter the 6-digit code from your authenticator app."}
              {step === "credentials" && "Password and TOTP are required. Password alone is not enough."}
              {step === "setup" && "Create a password and enroll TOTP before the admin portal can be used."}
              {step === "enroll" && "Scan the QR code, then confirm with a TOTP code."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            {step === "credentials" && (
              <form className="space-y-4" onSubmit={onCredentialsSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or username</Label>
                  <Input
                    id="identifier"
                    autoComplete="username"
                    value={identifier}
                    onChange={event => setIdentifier(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                </Button>
              </form>
            )}

            {step === "totp" && (
              <form className="space-y-4" onSubmit={onTotpSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="totp">Authenticator code</Label>
                  <Input
                    id="totp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={event => setTotpCode(event.target.value)}
                    maxLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("credentials");
                    setPendingToken("");
                    setTotpCode("");
                    setError(null);
                  }}
                >
                  Back
                </Button>
              </form>
            )}

            {step === "setup" && (
              <form className="space-y-4" onSubmit={onSetupSubmit}>
                {statusQuery.data?.setupTokenRequired && (
                  <div className="space-y-2">
                    <Label htmlFor="setupToken">Setup token</Label>
                    <Input
                      id="setupToken"
                      type="password"
                      value={setupToken}
                      onChange={event => setSetupToken(event.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Value of LOCAL_AUTH_SETUP_TOKEN from the server environment.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    minLength={12}
                    required
                  />
                  <p className="text-xs text-muted-foreground">At least 12 characters.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create password and show QR"}
                </Button>
              </form>
            )}

            {step === "enroll" && (
              <form className="space-y-4" onSubmit={onEnrollSubmit}>
                {qrCode && (
                  <div className="flex flex-col items-center gap-3">
                    <img src={qrCode} alt="Admin TOTP QR code" className="h-48 w-48 rounded-md border bg-white p-2" />
                    <div className="flex items-center gap-2 text-xs break-all text-muted-foreground">
                      <span>{secret}</span>
                      <Button type="button" size="icon" variant="ghost" onClick={copySecret}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="setup-totp">Authenticator code</Label>
                  <Input
                    id="setup-totp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={event => setTotpCode(event.target.value)}
                    maxLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish setup and sign in"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
