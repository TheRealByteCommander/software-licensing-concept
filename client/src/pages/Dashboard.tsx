import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Key, Users, Activity } from "lucide-react";

export default function Dashboard() {
  const { data: products, isLoading: productsLoading } = trpc.products.list.useQuery();
  const { data: licenses, isLoading: licensesLoading } = trpc.licenses.list.useQuery();
  const { data: customers, isLoading: customersLoading } = trpc.customers.list.useQuery();
  const { data: activations, isLoading: activationsLoading } = trpc.activations.list.useQuery();

  const stats = [
    {
      title: "Products",
      value: products?.length || 0,
      icon: Package,
      loading: productsLoading,
      description: "Total software products",
    },
    {
      title: "Licenses",
      value: licenses?.length || 0,
      icon: Key,
      loading: licensesLoading,
      description: "Active and inactive licenses",
    },
    {
      title: "Customers",
      value: customers?.length || 0,
      icon: Users,
      loading: customersLoading,
      description: "Registered customers",
    },
    {
      title: "Activations",
      value: activations?.filter(a => !a.deactivatedAt).length || 0,
      icon: Activity,
      loading: activationsLoading,
      description: "Currently active devices",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your licensing system</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {stat.loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stat.value}</div>
                )}
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activations</CardTitle>
            <CardDescription>Latest license activations</CardDescription>
          </CardHeader>
          <CardContent>
            {activationsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : activations && activations.length > 0 ? (
              <div className="space-y-2">
                {activations.slice(0, 5).map((activation) => (
                  <div
                    key={activation.id}
                    className="flex items-center justify-between border-b pb-2 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activation.licenseKey}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Device: {activation.deviceId.substring(0, 16)}...
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(activation.activatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No activations yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>License Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            {licensesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : licenses && licenses.length > 0 ? (
              <div className="space-y-3">
                {["active", "expired", "revoked", "grace_period"].map((status) => {
                  const count = licenses.filter((l) => l.status === status).length;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{status.replace("_", " ")}</span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No licenses yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
