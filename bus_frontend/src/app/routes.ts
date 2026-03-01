import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout";
import { HomePage } from "./components/home-page";
import { DeafPage } from "./components/deaf-page";
import { BlindPage } from "./components/blind-page";
import { AdminPage } from "./components/admin-page";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "deaf", Component: DeafPage },
      { path: "blind", Component: BlindPage },
      { path: "admin", Component: AdminPage },
    ],
  },
]);
