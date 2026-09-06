import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const utils = trpc.useUtils();
  const { data: users, isLoading, error } = trpc.users.list.useQuery();

  const roleMutation = trpc.users.setRole.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Role updated");
    },
    onError: err => toast.error(err.message),
  });

  const disabledMutation = trpc.users.setDisabled.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Account status updated");
    },
    onError: err => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Users</h1>
        <p className="text-muted-foreground">
          Optional extra vendor admins for this license server. End customers do not get accounts here.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Byte Commander staff only. Customers buy, renew, and cancel inside the product
            (AnomalyMatrix) via the public Stripe APIs. Local auth is a single env admin
            (`LOCAL_AUTH_*`); extra vendor admins sign in with OAuth, then get role admin here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error.message}</p>
          ) : users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Last signed in</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => {
                  const isSelf = currentUser?.id === user.id;
                  const busy = roleMutation.isPending || disabledMutation.isPending;
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.id}</TableCell>
                      <TableCell className="font-medium">
                        {user.name || "—"}
                        {isSelf ? (
                          <Badge variant="outline" className="ml-2">
                            You
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{user.email || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={user.role}
                          disabled={busy}
                          onValueChange={value =>
                            roleMutation.mutate({
                              id: user.id,
                              role: value as "user" | "admin",
                            })
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">admin</SelectItem>
                            <SelectItem value="user">user</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.loginMethod || "unknown"}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.lastSignedIn
                          ? new Date(user.lastSignedIn).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.disabled ? "secondary" : "default"}>
                          {user.disabled ? "Disabled" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            disabledMutation.mutate({
                              id: user.id,
                              disabled: !user.disabled,
                            })
                          }
                        >
                          {user.disabled ? "Enable" : "Disable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No portal users yet. Sign in once so the local or OAuth admin is recorded.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
