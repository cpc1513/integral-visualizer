import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { CalculatorPage } from "./features/calculator/CalculatorPage";

const PastExamsPage = lazy(() =>
  import("./features/questions/PastExamsPage").then((module) => ({
    default: module.PastExamsPage,
  })),
);

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<CalculatorPage />} />
          <Route
            path="exams"
            element={
              <Suspense fallback={<div className="route-loading">正在载入历年真题…</div>}>
                <PastExamsPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
