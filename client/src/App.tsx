import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Owner from "./pages/Owner";
import PolicyPage from "./pages/PolicyPage";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/o" component={Owner} />
    <Route path="/privacy"><PolicyPage kind="privacy" /></Route>
    <Route path="/cookies"><PolicyPage kind="cookies" /></Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
