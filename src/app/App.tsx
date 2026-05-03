import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "./auth/AuthContext";
import { router } from "./routes";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}
