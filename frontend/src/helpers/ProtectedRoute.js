import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";

/**
 * ProtectedRoute
 * - Sperrt den Zugriff, wenn der User nicht eingeloggt ist
 * - Synchronisiert App-State (token) mit localStorage
 * - Leitet automatisch zur Login-Seite um, wenn Token fehlt
 */
export default function ProtectedRoute({ token, setToken, children }) {
  const location = useLocation();

  // Bei jedem Render prüfen, ob sich der Token im localStorage geändert hat
  useEffect(() => {
    const storedToken = localStorage.getItem("token");

    // Falls im localStorage ein Token vorhanden ist, aber im State nicht
    if (storedToken && !token) {
      setToken(storedToken);
    }

    // Falls im localStorage KEIN Token mehr ist, aber noch im State
    if (!storedToken && token) {
      setToken(null);
    }
  }, [token, setToken]);

  // Wenn kein Token → Redirect zur Login-Seite
  if (!localStorage.getItem("token")) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Wenn eingeloggt → den geschützten Inhalt rendern
  return children;
}
