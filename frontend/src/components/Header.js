import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import matchLeagueLogo from "../images/matchleague_logo.png"; // use long branded logo
import "./Header.css";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  // close menu on route change
  useEffect(() => {
    const onPop = () => setOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Build same navPages as App.js used to
  const isAdmin = localStorage.getItem("is_admin") === "1";
  const token = localStorage.getItem("token");

  function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem("token");
    localStorage.removeItem("is_admin");
    // reload app state
    navigate("/login");
    window.location.reload();
  }

  const handleNavigate = () => setOpen(false);

  return (
    <header className="ml-header">
      <div className="ml-header__logo">
        <Link to="/start" className="ml-logo-link" aria-label="Start">
          <img src={matchLeagueLogo} alt="MatchLeague" className="ml-logo-full" />
        </Link>
      </div>

      {/* Right side controls: bell + burger on small screens */}
      <div className="ml-header__actions">
        {token && (
          <>
            <Link to="/news" className="ml-action" aria-label="Neuigkeiten" title="Neuigkeiten" onClick={handleNavigate}>
              <span className="ml-action__icon" role="img" aria-hidden="true">🔔</span>
            </Link>
            <Link to="/chats" className="ml-action" aria-label="Nachrichten" title="Nachrichten" onClick={handleNavigate}>
              <span className="ml-action__icon" role="img" aria-hidden="true">💬</span>
            </Link>
          </>
        )}
        <button className={"ml-burger" + (open ? " is-open" : "")} onClick={() => setOpen(v => !v)} aria-label="Menü">
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={"ml-header__menu" + (open ? " is-open" : "")}>        
        <nav className="ml-nav">
          {/* When not logged in: Login, Ligen, Städte, Registrieren (Teams ausgeblendet) */}
          {!token && (
            <>
              <Link to="/login" className="ml-nav__item" onClick={handleNavigate}>Login</Link>
              <Link to="/leagues" className="ml-nav__item" onClick={handleNavigate}>Ligen</Link>
              <Link to="/cities" className="ml-nav__item" onClick={handleNavigate}>Städte</Link>
              <Link to="/register" className="ml-nav__item" onClick={handleNavigate}>Registrieren</Link>
            </>
          )}

          {/* When logged in: Profil, Ligen, Städte */}
          {token && (
            <>
              <Link to="/profile" className="ml-nav__item" onClick={handleNavigate}>Profil</Link>
              <Link to="/teams" className="ml-nav__item" onClick={handleNavigate}>Teams</Link>
              <Link to="/leagues" className="ml-nav__item" onClick={handleNavigate}>Ligen</Link>
              <Link to="/cities" className="ml-nav__item" onClick={handleNavigate}>Städte</Link>
              <Link to="/chats" className="ml-nav__item" onClick={handleNavigate}>Chats</Link>
              <Link to="/news" className="ml-nav__item" onClick={handleNavigate}>Neuigkeiten</Link>
            </>
          )}

          {/* Admin extra links */}
          {isAdmin && (
            <>
              <Link to="/admin" className="ml-nav__item" onClick={handleNavigate}>Admin</Link>
              <Link to="/create" className="ml-nav__item" onClick={handleNavigate}>Create</Link>
            </>
          )}
        </nav>

        {/* Logout */}
        {token && (
          <div className="ml-logout">
            <a href="#logout" onClick={(e) => { handleNavigate(); handleLogout(e); }} className="ml-nav__item">Abmelden</a>
          </div>
        )}
      </div>
    </header>
  );
}
