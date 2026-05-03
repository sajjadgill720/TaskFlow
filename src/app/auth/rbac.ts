import type { AppRole } from "../../lib/database.types";

export function navAllowedForRole(role: AppRole | undefined): {
  dashboard: boolean;
  events: boolean;
  sellTickets: boolean;
  gateScanner: boolean;
  analytics: boolean;
  settings: boolean;
} {
  const staff = role === "organizer" || role === "admin";
  return {
    dashboard: true,
    events: staff,
    sellTickets: staff,
    gateScanner: staff,
    analytics: staff,
    settings: true,
  };
}
