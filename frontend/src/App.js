import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { routes } from "./helpers/autoRoutes";
import ProtectedRoute from "./helpers/ProtectedRoute";
import StartPage from "./pages/StartPage"; // neu
import LeaguesPage from "./pages/LeaguesPage";
import LeagueDetailPage from "./pages/LeagueDetailPage";
import TeamsPage from "./pages/TeamsPage";
import CreateTeamPage from "./pages/CreateTeamPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import CitiesPage from "./pages/CitiesPage"; // neu
import SportsDetailPage from "./pages/SportsDetailPage"; // neu
import CreatePage from "./pages/CreatePage"; // neu
import UserDetailPage from "./pages/UserDetailPage"; // neu
import GameDetailPage from "./pages/GameDetailPage"; // neu
import AdminPage from "./pages/AdminPage"; // neu
import matchLeagueLogo from "./images/matchleague_logo_long.png"; // Import the logo
import "./styles.css"; // neu
import Header from "./components/Header";
import WelcomePage from "./pages/WelcomePage"; // <-- add this import

// Simpler Adminerkennung (z.B. im Token, sonst im localStorage)
function isAdmin() {
  return localStorage.getItem("is_admin") === "1";
}

// Globale Fehlerbehandlung für API-Aufrufe
function fetchWithErrorLogging(url, options) {
  return fetch(url, options).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error fetching ${url} (HTTP ${response.status}): ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return response.json();
  });
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isAdminFlag, setIsAdminFlag] = useState(localStorage.getItem("is_admin") === "1");

  useEffect(() => {
    console.log("Token:", token);
    console.log("Is Admin:", isAdminFlag);
  }, [token, isAdminFlag]);

  // Hintergrundrotation mit Bildern "l-*" aus src/images
  useEffect(() => {
    let images = [];
    try {
      const ctx = require.context("./images", false, /^\.\/l-.*\.(png|jpe?g|webp|gif)$/i);
      images = ctx.keys().map(ctx);
    } catch {
      images = [];
    }
    if (!images.length) return;
    let i = Math.floor(Math.random() * images.length);
    const apply = () => {
      document.documentElement.style.setProperty("--bg-url", `url(${images[i]})`);
      i = (i + 1) % images.length;
    };
    apply();
    const t = setInterval(apply, 20000);
    return () => clearInterval(t);
  }, []);

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
      <Header />

      {/* --- Routen --- */}
      <div className="app-content" >
        <Routes>
          {/* public routes */}
          <Route path="/welcome" element={<WelcomePage setToken={setToken} setIsAdminFlag={setIsAdminFlag} />} />
          <Route path="/registration-success" element={<WelcomePage setToken={setToken} setIsAdminFlag={setIsAdminFlag} />} />

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

          {/* Leagues-Übersicht (public) */}
          <Route path="/leagues" element={<LeaguesPage />} />

          {/* Teams */}

          {/* League-Detail (public) */}
          <Route path="/league/:leagueId" element={<LeagueDetailPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/create" element={<CreateTeamPage />} />
          <Route path="/teams/:id" element={<TeamDetailPage />} />

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
            path="/user/:id" // Stelle sicher, dass ":id" korrekt definiert ist
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <UserDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Spiel-Detail */}
          <Route
            path="/matches/:gameId"
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

          {/* Profil (nur Admin) */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                {isAdminFlag ? (
                  <UserDetailPage />
                ) : (
                  <div style={{ padding: 16 }}>403 – Zugriff verweigert. Nur für Admins.</div>
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
      </div>
    </Router>
  );
}

export default App;

