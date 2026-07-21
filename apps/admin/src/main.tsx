/* eslint-disable react-refresh/only-export-components */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./i18n";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AdminShell } from "./components/AdminShell";

const Dashboard = React.lazy(() => import("./routes/Dashboard").then(m => ({ default: m.Dashboard })));
const Modules = React.lazy(() => import("./routes/Modules").then(m => ({ default: m.Modules })));
const Players = React.lazy(() => import("./routes/Players").then(m => ({ default: m.Players })));
const Operations = React.lazy(() => import("./routes/Operations").then(m => ({ default: m.Operations })));
const Settings = React.lazy(() => import("./routes/Settings").then(m => ({ default: m.Settings })));
const Assets = React.lazy(() => import("./routes/Assets").then(m => ({ default: m.Assets })));

const queryClient = new QueryClient();

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
        element: <Operations />,
      },
      {
        path: "players",
        element: <Players />,
      },
      {
        path: "assets",
        element: <Assets />,
      },
      {
        path: "settings",
        element: <Settings />,
      }
    ],
  },
], { basename: "/admin" });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div style={{ padding: "2rem" }}>Loading App...</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </QueryClientProvider>
  </React.StrictMode>
);
