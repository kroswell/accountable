import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import "@fontsource/instrument-sans/latin-400.css";
import "@fontsource/instrument-sans/latin-500.css";
import "@fontsource/instrument-sans/latin-600.css";
import "@fontsource/instrument-sans/latin-700.css";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { PipelinePage } from "./features/pipeline/PipelinePage";
import { DealCreateDialog, RecordDetailPage, RecordListPage } from "./features/shared/RecordPages";
import "./styles/global.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
const nav = [
  ["Dashboard", "/"], ["Organizations", "/organizations"], ["Contacts", "/contacts"], ["Deals", "/deals"], ["Pipeline", "/pipeline"],
];

function App() {
  const [addingDeal, setAddingDeal] = useState(false);
  return <div className="app-shell">
    <header className="topbar"><Link className="brand" to="/">Accountable</Link>
      <nav aria-label="Primary navigation">{nav.map(([label, path]) => <NavLink key={path} to={path} end={path === "/"} className={({ isActive }) => isActive ? "active" : ""}>{label}</NavLink>)}</nav>
      <button className="primary-button top-create" onClick={() => setAddingDeal(true)}>+ New deal</button>
    </header>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/organizations" element={<RecordListPage kind="organizations" />} />
      <Route path="/organizations/:id" element={<RecordDetailPage kind="organizations" />} />
      <Route path="/contacts" element={<RecordListPage kind="contacts" />} />
      <Route path="/contacts/:id" element={<RecordDetailPage kind="contacts" />} />
      <Route path="/deals" element={<RecordListPage kind="deals" />} />
      <Route path="/deals/:id" element={<RecordDetailPage kind="deals" />} />
      <Route path="/pipeline" element={<PipelinePage />} />
      <Route path="*" element={<main className="page"><h1>Page not found</h1><Link to="/">Return to dashboard</Link></main>} />
    </Routes>
    {addingDeal && <DealCreateDialog onClose={() => setAddingDeal(false)} />}
  </div>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><BrowserRouter><QueryClientProvider client={queryClient}><App /></QueryClientProvider></BrowserRouter></StrictMode>,
);
