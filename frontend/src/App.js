import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
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
import UserChatPage from "./pages/UserChatPage"; // neu
import GameDetailPage from "./pages/GameDetailPage"; // neu
import MatchChatPage from "./pages/MatchChatPage"; // match chat page
import SearchMatchDialog from "./pages/SearchMatchDialog"; // neu
import AdminPage from "./pages/AdminPage"; // neu
import AdminPublishing from "./pages/AdminPublishing"; // publishing admin page
import EditProfilePage from "./pages/EditProfilePage"; // edit profile
import BookingPage from "./pages/BookingPage"; // booking page (legacy redirects to /slots)
import SlotSearchPage from "./pages/SlotSearchPage";
import SlotReviewPage from "./pages/SlotReviewPage";
import TournamentsPage from "./pages/TournamentsPage"; // tournaments page
import BookingPaymentPage from "./pages/BookingPaymentPage";
import BookingConfirmationPage from "./pages/BookingConfirmationPage";
import BookingDetailPage from "./pages/BookingDetailPage";
import MyBookingsPage from "./pages/MyBookingsPage"; // my bookings
import LocationManagerPage from "./pages/LocationManagerPage"; // location manager
import LocationDetailsPage from "./pages/LocationDetailsPage"; // location details
import BookingReportingPage from "./pages/BookingReportingPage"; // booking reporting
import AssetConfiguratorPage from "./pages/AssetConfiguratorPage"; // asset configurator
import matchLeagueLogo from "./images/logo/matchleague_logo_4x4-removebg-preview.png"; // Import the logo
import "./styles.css"; // neu
import Header from "./components/Header";
import WelcomePage from "./pages/WelcomePage"; // <-- add this import
import DevSportsImages from "./pages/DevSportsImages"; // dev gallery
import SubscriptionsPage from "./pages/SubscriptionsPage"; // subscriptions/roles
import TasksBoardPage from "./pages/TasksBoardPage";
import ComplianceDashboardPage from "./pages/ComplianceDashboardPage";
import ImpressumPage from "./pages/ImpressumPage";
import DatenschutzPage from "./pages/DatenschutzPage";
import AGBPage from "./pages/AGBPage";
import ReportIllegalContentPage from "./pages/ReportIllegalContentPage";
import LegalFooter from "./components/LegalFooter";
import CookieBanner from "./components/CookieBanner";
import { LanguageProvider } from "./i18n";

// Production Landing Page & Feature Flags
import ProductionWorkInProgress from "./pages/ProductionWorkInProgress";
import { FEATURES, INSTANCE_TYPE } from "./config";
import { BookingsFeature, CompetitionsFeature } from "./components/FeatureWrapper";

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

// Mount-only component inside Router to attach global 401 handling with navigation available
function NavigationGuard({ setToken }) {
  const navigate = useNavigate();

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const res = await originalFetch(input, init);
      try {
        if (res && res.status === 401) {
          let bodyText = "";
          try {
            const clone = res.clone();
            bodyText = await clone.text();
          } catch (_) {}
          if (String(bodyText).toLowerCase().includes("invalid token")) {
            try {
              localStorage.removeItem("token");
              localStorage.setItem("authNotice", "Deine Sitzung ist abgelaufen. Bitte erneut einloggen.");
            } catch (_) {}
            setToken(null);
            navigate("/login");
          }
        }
      } catch (_) {}
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [navigate, setToken]);
  return null;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isAdminFlag, setIsAdminFlag] = useState(localStorage.getItem("is_admin") === "1");
  const showProjectTasks = ["development", "dev", "local"].includes(String(INSTANCE_TYPE || "").toLowerCase());

  useEffect(() => {
    // Suppress harmless network errors from non-critical API calls (e.g., public stats)
    const handleRejection = (event) => {
      if (event.reason && event.reason.message === 'Failed to fetch') {
        // Silently ignore fetch errors - they're likely from non-critical endpoints
        // and are being handled gracefully in the components that call them
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  useEffect(() => {
    console.log("Token:", token);
    console.log("Is Admin:", isAdminFlag);
    console.log("Instance Type:", INSTANCE_TYPE);
    console.log("Features:", FEATURES);
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

  // Production Instance: Show only landing page
  // This conditional return is AFTER all hooks have been called
  if (FEATURES.SHOW_ONLY_LANDING) {
    return (
      <Router>
        <Routes>
          <Route path="*" element={<ProductionWorkInProgress />} />
        </Routes>
      </Router>
    );
  }

  return (
    <LanguageProvider>
    <Router>
      {/* NavigationGuard attaches global 401 Invalid token handling */}
      <NavigationGuard setToken={setToken} />
      
      <Routes>
        {/* public routes without header */}
        <Route path="/welcome" element={<WelcomePage setToken={setToken} setIsAdminFlag={setIsAdminFlag} />} />
        <Route path="/registration-success" element={<WelcomePage setToken={setToken} setIsAdminFlag={setIsAdminFlag} />} />

        {/* Login & Register without header */}
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

        {/* All other routes with header */}
        <Route path="*" element={
          <>
            <Header />
            <div className="app-content">
              <Routes>

          {/* Geschützte Seiten (ohne /leagues und ohne /create, eigene Routen unten) */}
          {routes
            .filter(r => ![
              "/login",
              "/register",
              "/leagues",
              "/create",
              "/tasks",
              "/agb",
              "/datenschutz",
              "/impressum",
              "/reportillegalcontent"
            ].includes(r.path))
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
          <Route path="/ligen" element={<LeaguesPage />} />

          {/* Rechtstexte (public) */}
          <Route path="/impressum" element={<ImpressumPage />} />
          <Route path="/datenschutz" element={<DatenschutzPage />} />
          <Route path="/agb" element={<AGBPage />} />
          <Route path="/nutzungsbedingungen" element={<AGBPage />} />
          <Route path="/meldung-rechtswidriger-inhalte" element={<ReportIllegalContentPage />} />

          {/* Subscriptions/Abos (public) */}
          <Route path="/abos" element={<SubscriptionsPage />} />

          {/* Tasks Board (nur lokal/dev) */}
          {showProjectTasks ? <Route path="/tasks" element={<TasksBoardPage />} /> : null}

          <Route
            path="/compliance"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <ComplianceDashboardPage />
              </ProtectedRoute>
            }
          />

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

          {/* Direkter Chat zwischen Nutzern */}
          <Route
            path="/chat/user/:id"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <UserChatPage />
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
          {/* Match-Chat */}
          <Route
            path="/matches/:matchId/chat"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <MatchChatPage />
              </ProtectedRoute>
            }
          />
          {/* Match-Chat */}
          <Route
            path="/matches/:matchId/chat"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <MatchChatPage />
              </ProtectedRoute>
            }
          />

          {/* Match-Suche (eigene Seite) */}
          <Route
            path="/match-search"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <SearchMatchDialog />
              </ProtectedRoute>
            }
          />

          {/* Turniere */}
          <Route
            path="/tournaments"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <CompetitionsFeature>
                  <TournamentsPage />
                </CompetitionsFeature>
              </ProtectedRoute>
            }
          />

          {/* Booking / Platzbuchung */}
          <Route
            path="/booking"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <BookingPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          {/* New booking flow routes */}
          <Route
            path="/slots"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <SlotSearchPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/slot/:slotId"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <SlotReviewPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:bookingId/payment"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <BookingPaymentPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:bookingId/confirm"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <BookingConfirmationPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/:bookingId"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <BookingDetailPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <MyBookingsPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings/:id"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingsFeature>
                  <MyBookingsPage />
                </BookingsFeature>
              </ProtectedRoute>
            }
          />
          
          {/* Dev: Sports Images mini browser */}
          <Route
            path="/dev/images/sports"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <DevSportsImages />
              </ProtectedRoute>
            }
          />

          {/* Location Manager */}
          <Route
            path="/location-manager"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <LocationManagerPage />
              </ProtectedRoute>
            }
          />

          {/* Booking Reporting */}
          <Route
            path="/booking-reporting"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <BookingReportingPage />
              </ProtectedRoute>
            }
          />

          {/* Location Details */}
          <Route
            path="/location/:locationId"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <LocationDetailsPage />
              </ProtectedRoute>
            }
          />

          {/* Asset Configurator */}
          <Route
            path="/location/:locationId/asset/:assetId/configure"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <AssetConfiguratorPage />
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

          {/* Admin Publishing (nur Admin) */}
          <Route
            path="/admin/publishing"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                {isAdminFlag ? (
                  <AdminPublishing />
                ) : (
                  <div style={{ padding: 16 }}>403 – Nur für Admins</div>
                )}
              </ProtectedRoute>
            }
          />

          {/* Profil bearbeiten */}
          <Route
            path="/profile/edit"
            element={
              <ProtectedRoute token={token} setToken={setToken}>
                <EditProfilePage />
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
          </>
        } />
      </Routes>
      <LegalFooter />
      <CookieBanner />
    </Router>
    </LanguageProvider>
  );
}

export default App;

