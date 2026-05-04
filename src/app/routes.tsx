import { createBrowserRouter } from "react-router";
import LoginPage from "./components/LoginPage";
import SignUpPage from "./components/SignUpPage";
import InviteRedeemPage from "./components/InviteRedeemPage";
import DashboardRoot from "./components/DashboardRoot";
import DashboardLayout from "./components/DashboardLayout";
import DashboardHome from "./components/Dashboard";
import MyEventsPage from "./components/MyEventsPage";
import SellTicketsPage from "./components/SellTicketsPage";
import GateScannerPage from "./components/GateScannerPage";
import AnalyticsPage from "./components/AnalyticsPage";
import SettingsPage from "./components/SettingsPage";
import ExplorePage from "./components/ExplorePage";
import AttendeeEventDetailPage from "./components/AttendeeEventDetailPage";
import AdminOrganizersPage from "./components/AdminOrganizersPage";
import RequireRole from "./components/RequireRole";

export const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/signup", Component: SignUpPage },
  { path: "/invite/:token", Component: InviteRedeemPage },
  {
    path: "/dashboard",
    Component: DashboardRoot,
    children: [
      {
        Component: DashboardLayout,
        children: [
          { index: true, Component: DashboardHome },
          { path: "explore", Component: ExplorePage },
          { path: "explore/event/:eventId", Component: AttendeeEventDetailPage },
          {
            path: "admin/organizers",
            element: (
              <RequireRole allow={["admin"]}>
                <AdminOrganizersPage />
              </RequireRole>
            ),
          },
          {
            path: "events",
            element: (
              <RequireRole allow={["organizer", "admin"]}>
                <MyEventsPage />
              </RequireRole>
            ),
          },
          {
            path: "sell-tickets",
            element: (
              <RequireRole allow={["organizer", "admin"]}>
                <SellTicketsPage />
              </RequireRole>
            ),
          },
          {
            path: "gate-scanner",
            element: (
              <RequireRole allow={["organizer", "admin"]}>
                <GateScannerPage />
              </RequireRole>
            ),
          },
          {
            path: "analytics",
            element: (
              <RequireRole allow={["organizer", "admin"]}>
                <AnalyticsPage />
              </RequireRole>
            ),
          },
          { path: "settings", Component: SettingsPage },
        ],
      },
    ],
  },
]);
