import { Calculator, LibraryBig } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  { to: "/", label: "在线计算", icon: Calculator, end: true },
  { to: "/exams", label: "往年真题", icon: LibraryBig, end: false },
] as const;

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="积分视界在线计算">
          积分视界
        </NavLink>
        <nav className="topnav" aria-label="主导航">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `topnav-link${isActive ? " is-active" : ""}`}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
