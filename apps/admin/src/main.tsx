import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@cloudflare/kumo/styles";
import "./index.css";
import "./i18n";

import { AdminShell } from "./components/AdminShell";
import { Dashboard } from "./routes/Dashboard";
import { Modules } from "./routes/Modules";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AdminShell />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "modules",
        element: <Modules />,
      },
      {
        path: "operations",
        element: <div>Operations (WIP)</div>,
      },
      {
        path: "players",
        element: <div>Players (WIP)</div>,
      },
      {
        path: "settings",
        element: <div>Settings (WIP)</div>,
      }
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
