import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";

type ProductTwoFADialogProps = {
  product: { id: number; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ProductTwoFADialog({
  product,
  open,
  onOpenChange,
}: ProductTwoFADialogProps) {
  const utils = trpc.useUtils();
  const [setupResult, setSetupResult] = useState<{
    qrCode: string;
    secret: string;
    backupCodes: string[];
  } | null>(null);

  const statusQuery = trpc.twoFA.getStatus.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: open && !!product }
  );

  const setupMutation = trpc.twoFA.setupTwoFA.useMutation({
    onSuccess: (data) => {
      setSetupResult({
        qrCode: data.qrCode,
        secret: data.secret,
        backupCodes: data.backupCodes,
      });
      utils.twoFA.getStatus.invalidate({ productId: product!.id });
      toast.success("2FA configured successfully");
    },
    onError: (error) => toast.error(error.message),
  });

  const enableMutation = trpc.twoFA.enableFor2FA.useMutation({
    onSuccess: () => {
      utils.twoFA.getStatus.invalidate({ productId: product!.id });
      toast.success("2FA requirement enabled");
    },
    onError: (error) => toast.error(error.message),
  });

  const disableMutation = trpc.twoFA.disableFor2FA.useMutation({
    onSuccess: () => {
      utils.twoFA.getStatus.invalidate({ productId: product!.id });
      toast.success("2FA requirement disabled");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!open) {
      setSetupResult(null);
    }
  }, [open]);

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  };

  const status = statusQuery.data;
  const isConfigured = status?.isConfigured ?? false;
  const require2FA = status?.require2FA ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>2FA Management</DialogTitle>
          <DialogDescription>
            Configure Google Authenticator for new license activations on{" "}
            <span className="font-medium">{product?.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant={isConfigured ? "default" : "secondary"}>
              {isConfigured ? "Configured" : "Not configured"}
            </Badge>
            <Badge variant={require2FA ? "default" : "outline"}>
              {require2FA ? "Required for activation" : "Optional"}
            </Badge>
          </div>

          <Alert>
            <AlertDescription>
              2FA applies only to new device activations. Existing tokens continue to validate
              normally.
            </AlertDescription>
          </Alert>

          {!isConfigured && !setupResult && (
            <p className="text-sm text-muted-foreground">
              Set up 2FA to generate a TOTP secret and QR code for Google Authenticator.
            </p>
          )}

          {setupResult && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex justify-center">
                <img
                  src={setupResult.qrCode}
                  alt="2FA QR code"
                  className="h-48 w-48 rounded-md border bg-white p-2"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp-secret">TOTP Secret</Label>
                <div className="flex gap-2">
                  <Input id="totp-secret" value={setupResult.secret} readOnly />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(setupResult.secret, "Secret")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Backup Codes</Label>
                <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 font-mono text-sm">
                  {setupResult.backupCodes.map((code) => (
                    <span key={code}>{code}</span>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(setupResult.backupCodes.join("\n"), "Backup codes")
                  }
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy backup codes
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {!isConfigured && (
              <Button
                onClick={() => product && setupMutation.mutate({ productId: product.id })}
                disabled={!product || setupMutation.isPending}
              >
                {setupMutation.isPending ? "Setting up..." : "Setup 2FA"}
              </Button>
            )}

            {isConfigured && !require2FA && (
              <Button
                onClick={() => product && enableMutation.mutate({ productId: product.id })}
                disabled={!product || enableMutation.isPending}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {enableMutation.isPending ? "Enabling..." : "Enable requirement"}
              </Button>
            )}

            {isConfigured && require2FA && (
              <Button
                variant="destructive"
                onClick={() => product && disableMutation.mutate({ productId: product.id })}
                disabled={!product || disableMutation.isPending}
              >
                <ShieldOff className="mr-2 h-4 w-4" />
                {disableMutation.isPending ? "Disabling..." : "Disable requirement"}
              </Button>
            )}
          </div>

          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
