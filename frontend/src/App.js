import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { routes } from "./helpers/autoRoutes";
import ProtectedRoute from "./helpers/ProtectedRoute";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isAdminFlag, setIsAdminFlag] = useState(localStorage.getItem("is_admin") === "1");

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
            <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/league">
              League
            </Link>
            {/* Create nur für Admin */}
            {isAdminFlag && (
              <Link style={{ color: "#d3d3d3", fontWeight: "bold" }} to="/create">
                Create
              </Link>
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
        {/* Login, Register & Reset immer erreichbar */}
        {routes
          .filter(r => r.path === "/login" || r.path === "/register" || r.path === "/reset")
          .map(r => (
            <Route
              key={r.path}
              path={r.path}
              element={React.cloneElement(r.element, {
                ...(r.path === "/login" ? { setToken, setIsAdminFlag } : {})
              })}
            />
          ))}

        {/* Geschützte Seiten */}
        {routes
          .filter(r => r.path !== "/login" && r.path !== "/register" && r.path !== "/reset")
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

        {/* Startseite geschützt */}
        <Route
          path="/"
          element={
            <ProtectedRoute token={token} setToken={setToken}>
              <div>
                <h1>Sportplattform</h1>
                <p>Herzlich willkommen!</p>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
