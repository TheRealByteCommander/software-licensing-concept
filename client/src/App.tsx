import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Licenses from "./pages/Licenses";
import Customers from "./pages/Customers";
import Activations from "./pages/Activations";
import Webhooks from "./pages/Webhooks";
import Billing from "./pages/Billing";
import Checkout from "./pages/Checkout";
import AdminUsers from "./pages/AdminUsers";

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path={"/products"}>
        <DashboardLayout>
          <Products />
        </DashboardLayout>
      </Route>
      <Route path={"/licenses"}>
        <DashboardLayout>
          <Licenses />
        </DashboardLayout>
      </Route>
      <Route path={"/customers"}>
        <DashboardLayout>
          <Customers />
        </DashboardLayout>
      </Route>
      <Route path={"/activations"}>
        <DashboardLayout>
          <Activations />
        </DashboardLayout>
      </Route>
      <Route path={"/webhooks"}>
        <DashboardLayout>
          <Webhooks />
        </DashboardLayout>
      </Route>
      <Route path={"/billing"}>
        <DashboardLayout>
          <Billing />
        </DashboardLayout>
      </Route>
      <Route path={"/admins"}>
        <DashboardLayout>
          <AdminUsers />
        </DashboardLayout>
      </Route>
      <Route path={"/checkout"} component={Checkout} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
