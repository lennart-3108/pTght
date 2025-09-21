import React from "react";
import { Link, useNavigate } from "react-router-dom";
import matchLeagueLogo from "../images/matchleague_logo_long.png"; // use long branded logo
import "./Header.css";
import { routes } from "../helpers/autoRoutes";

function titleForPath(path) {
  const map = {
    "/start": "Start",
    "/": "Start",
    "/leagues": "Ligen",
    "/cities": "Städte",
    "/sports": "Sportarten",
    "/admin": "Admin",
    "/profile": "Profil",
    "/create": "Erstellen",
  };
  if (map[path]) return map[path];
  // fallback: strip leading slash and capitalize
  const p = path.replace(/^\//, "");
  if (!p) return "Start";
  return p.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
}

export default function Header() {
  const navigate = useNavigate();

  // Build same navPages as App.js used to
  const isAdmin = localStorage.getItem("is_admin") === "1";
  const token = localStorage.getItem("token");

  const navPages = routes
    .filter(r => !["/logout", "/login", "/register"].includes(r.path))
    .filter(r => !(r.path === "/create" && !isAdmin));

  function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("is_admin");
    // reload app state
    navigate("/login");
    window.location.reload();
  }

  return (
    <header className="ml-header">
      <div className="ml-header__logo">
        <Link to="/start" className="ml-logo-link" aria-label="Start">
          <img src={matchLeagueLogo} alt="MatchLeague" className="ml-logo-full" />
        </Link>
      </div>

      <div className="ml-header__menu">
        <nav className="ml-nav">
          {/* When not logged in: Login, Ligen, Städte, Registrieren */}
          {!token && (
            <>
              <Link to="/login" className="ml-nav__item">Login</Link>
              <Link to="/leagues" className="ml-nav__item">Ligen</Link>
              <Link to="/teams" className="ml-nav__item">Teams</Link>
              <Link to="/cities" className="ml-nav__item">Städte</Link>
              <Link to="/register" className="ml-nav__item">Registrieren</Link>
            </>
          )}

          {/* When logged in: Profil, Ligen, Städte */}
          {token && (
            <>
              <Link to="/profile" className="ml-nav__item">Profil</Link>
              <Link to="/teams" className="ml-nav__item">Teams</Link>
              <Link to="/leagues" className="ml-nav__item">Ligen</Link>
              <Link to="/cities" className="ml-nav__item">Städte</Link>
            </>
          )}

          {/* Admin extra links */}
          {isAdmin && (
            <>
              <Link to="/admin" className="ml-nav__item">Admin</Link>
              <Link to="/create" className="ml-nav__item">Create</Link>
            </>
          )}
        </nav>

        {/* Logout always at the far right */}
        {token && (
          <div className="ml-logout">
            <a href="#logout" onClick={handleLogout} className="ml-nav__item">Abmelden</a>
          </div>
        )}
      </div>
    </header>
  );
}
