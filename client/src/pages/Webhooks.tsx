import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_EVENTS = [
  "license.activated",
  "license.deactivated",
  "license.revoked",
  "license.expired",
  "license.renewed",
] as const;

type WebhookFormState = {
  url: string;
  secret: string;
  events: string[];
  active: boolean;
};

const emptyForm = (): WebhookFormState => ({
  url: "",
  secret: "",
  events: ["license.activated"],
  active: true,
});

export default function Webhooks() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<any>(null);
  const [form, setForm] = useState<WebhookFormState>(emptyForm());

  const utils = trpc.useUtils();
  const { data: webhooks, isLoading } = trpc.webhooks.list.useQuery();

  const resetForm = () => setForm(emptyForm());

  const createMutation = trpc.webhooks.create.useMutation({
    onSuccess: () => {
      utils.webhooks.list.invalidate();
      setIsCreateOpen(false);
      resetForm();
      toast.success("Webhook created");
    },
    onError: error => toast.error(error.message),
  });

  const updateMutation = trpc.webhooks.update.useMutation({
    onSuccess: () => {
      utils.webhooks.list.invalidate();
      setEditingWebhook(null);
      resetForm();
      toast.success("Webhook updated");
    },
    onError: error => toast.error(error.message),
  });

  const deleteMutation = trpc.webhooks.delete.useMutation({
    onSuccess: () => {
      utils.webhooks.list.invalidate();
      toast.success("Webhook deleted");
    },
    onError: error => toast.error(error.message),
  });

  const testMutation = trpc.webhooks.test.useMutation({
    onSuccess: () => toast.success("Test event sent"),
    onError: error => toast.error(error.message),
  });

  const parsedEvents = useMemo(
    () =>
      (webhooks ?? []).map(webhook => ({
        ...webhook,
        eventList: safeParseEvents(webhook.events),
      })),
    [webhooks]
  );

  const toggleEvent = (event: string, checked: boolean) => {
    setForm(current => ({
      ...current,
      events: checked
        ? Array.from(new Set([...current.events, event]))
        : current.events.filter(item => item !== event),
    }));
  };

  const openEdit = (webhook: any) => {
    setEditingWebhook(webhook);
    setForm({
      url: webhook.url,
      secret: webhook.secret ?? "",
      events: safeParseEvents(webhook.events),
      active: webhook.active,
    });
  };

  const handleSave = () => {
    if (!form.url || form.events.length === 0) {
      toast.error("URL and at least one event are required");
      return;
    }

    if (editingWebhook) {
      updateMutation.mutate({
        id: editingWebhook.id,
        url: form.url,
        secret: form.secret || undefined,
        events: form.events as (typeof WEBHOOK_EVENTS)[number][],
        active: form.active,
      });
      return;
    }

    createMutation.mutate({
      url: form.url,
      secret: form.secret || undefined,
      events: form.events as (typeof WEBHOOK_EVENTS)[number][],
      active: form.active,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">
            Send license lifecycle events to external systems
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Webhooks</CardTitle>
          <CardDescription>
            Payloads are signed with HMAC SHA-256 in the `X-License-Signature` header when a secret is set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : parsedEvents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedEvents.map(webhook => (
                  <TableRow key={webhook.id}>
                    <TableCell className="max-w-xs truncate">{webhook.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.eventList.map(event => (
                          <Badge key={event} variant="outline">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={webhook.active ? "default" : "secondary"}>
                        {webhook.active ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testMutation.mutate({ id: webhook.id })}
                      >
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(webhook)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Delete this webhook?")) {
                            deleteMutation.mutate({ id: webhook.id });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No webhooks configured yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isCreateOpen || !!editingWebhook}
        onOpenChange={open => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingWebhook(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? "Edit Webhook" : "Add Webhook"}</DialogTitle>
            <DialogDescription>
              Receive HTTP POST notifications when license events occur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/hooks/licenses"
              />
            </div>
            <div>
              <Label htmlFor="webhook-secret">Secret (optional)</Label>
              <Input
                id="webhook-secret"
                value={form.secret}
                onChange={e => setForm({ ...form, secret: e.target.value })}
                placeholder="Auto-generated if empty on create"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              {WEBHOOK_EVENTS.map(event => (
                <label key={event} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.events.includes(event)}
                    onCheckedChange={checked => toggleEvent(event, checked === true)}
                  />
                  {event}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="webhook-active">Active</Label>
              <Switch
                id="webhook-active"
                checked={form.active}
                onCheckedChange={checked => setForm({ ...form, active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingWebhook(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingWebhook ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function safeParseEvents(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
  } catch {
    return [];
  }
}
