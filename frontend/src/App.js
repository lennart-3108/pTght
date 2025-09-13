import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { routes } from "./helpers/autoRoutes";
import ProtectedRoute from "./helpers/ProtectedRoute";
import StartPage from "./pages/StartPage"; // neu
import LeaguesPage from "./pages/LeaguesPage";
import LeagueDetailPage from "./pages/LeagueDetailPage";
import CitiesPage from "./pages/CitiesPage"; // neu
import SportsDetailPage from "./pages/SportsDetailPage"; // neu
import CreatePage from "./pages/CreatePage"; // neu
import UserDetailPage from "./pages/UserDetailPage"; // neu
import GameDetailPage from "./pages/GameDetailPage"; // neu
import AdminPage from "./pages/AdminPage"; // neu

// Simpler Adminerkennung (z.B. im Token, sonst im localStorage)
function isAdmin() {
  return localStorage.getItem("is_admin") === "1";
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isAdminFlag, setIsAdminFlag] = useState(localStorage.getItem("is_admin") === "1");

  // Nur Hauptseiten ohne Login/Register/Logout und ohne Parameter
  const navPages = routes
    .filter(
      r =>
        !["/logout", "/login", "/register"].includes(r.path) &&
        !/:/.test(r.path)
    )
    .filter(r =>
      // "Create" nur für Admin zeigen
      !(r.path === "/create" && !isAdminFlag)
    );

  return (
    <Router>
      {/* --- Header --- */}
      <nav
        style={{
          padding: "10px 20px",
          backgroundColor: "#00748F",
          color: "#fff",
          display: "flex",
          gap: "15px",
          alignItems: "center",
          borderBottom: "4px solid rgb(141, 195, 131)"
        }}
      >
        <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/">
          Start
        </Link>

        {!token ? (
          <>
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/login">
              Login
            </Link>
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/register">
              Registrieren
            </Link>
          </>
        ) : (
          <>
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/profile">
              Profil
            </Link>
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/sports">
              Sportarten
            </Link>
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/cities">
              Städte
            </Link>
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/leagues">
              Leagues
            </Link>
            {/* Create nur für Admin */}
            {isAdminFlag && (
              <>
                <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/create">
                  Create
                </Link>
                <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/admin">
                  Admin
                </Link>
              </>
            )}
            {/* Nur EIN Logout-Link und Button auf der Logout-Page */}
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/logout">
              Logout
            </Link>
          </>
        )}
      </nav>

      {/* --- Routen --- */}
      <Routes>
        {/* Login & Register immer erreichbar */}
        {routes
          .filter(r => r.path === "/login" || r.path === "/register")
          .map(r => (
            <Route
              key={r.path}
              path={r.path}
              element={React.cloneElement(r.element, {
                ...(r.path === "/login" ? { setToken, setIsAdminFlag } : {})
              })}
            />
          ))}

        {/* Geschützte Seiten (ohne /leagues und ohne /create, eigene Routen unten) */}
        {routes
          .filter(r => r.path !== "/login" && r.path !== "/register")
          .filter(r => r.path !== "/leagues")
          .filter(r => r.path !== "/create") // neu: /create separat unten
          .map(r => (
            <Route
              key={r.path}
              path={r.path}
              element={
                <ProtectedRoute token={token} setToken={setToken}>
                  {React.cloneElement(r.element, {
                    ...(r.path === "/logout" ? { setToken, setIsAdminFlag } : {}),
                    ...(r.path === "/create" ? { isAdmin: isAdminFlag } : {})
                  })}
                </ProtectedRoute>
              }
            />
          ))}

        {/* Leagues-Übersicht */}
        <Route
          path="/leagues"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <LeaguesPage />
            </ProtectedRoute>
          }
        />
        {/* League-Detail */}
        <Route
          path="/league/:leagueId"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <LeagueDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Städte */}
        <Route
          path="/cities"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <CitiesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cities/:cityId"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <CitiesPage />
            </ProtectedRoute>
          }
        />

        {/* Sport Detail */}
        <Route
          path="/sports/:id"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <SportsDetailPage />
            </ProtectedRoute>
          }
        />

        {/* User Profil (öffentliches Profil) */}
        <Route
          path="/user/:userId"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <UserDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Spiel-Detail */}
        <Route
          path="/game/:gameId"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <GameDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Create (nur Admin) */}
        <Route
          path="/create"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              {isAdminFlag ? (
                <CreatePage />
              ) : (
                <div style={{ padding: 16 }}>403 – Nur für Admins</div>
              )}
            </ProtectedRoute>
          }
        />

        {/* Admin (nur Admin) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              {isAdminFlag ? (
                <AdminPage />
              ) : (
                <div style={{ padding: 16 }}>403 – Nur für Admins</div>
              )}
            </ProtectedRoute>
          }
        />

        {/* Startseite geschützt */}
        <Route
          path="/"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <StartPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

