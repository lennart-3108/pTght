import React, { useEffect, useState } from "react";

// Reusable banner that shows a one-time auth notice stored in localStorage.authNotice
// Used for auto-logout flows: components mount, read & clear the message, then auto-hide.
export default function AuthNoticeBanner() {
  const [authNotice, setAuthNotice] = useState("");

  // read once from localStorage on mount
  useEffect(() => {
    try {
      if (typeof localStorage === "undefined") return;
      const msg = localStorage.getItem("authNotice");
      if (msg) {
        setAuthNotice(msg);
        localStorage.removeItem("authNotice");
      }
    } catch (_) {
      // ignore
    }
  }, []);

  // auto-hide after 7 seconds
  useEffect(() => {
    if (!authNotice) return;
    const t = setTimeout(() => setAuthNotice(""), 7000);
    return () => clearTimeout(t);
  }, [authNotice]);

  if (!authNotice) return null;

  return (
    <div
      style={{
        padding: 12,
        margin: "8px 16px",
        borderRadius: 8,
        background: "rgba(55,65,81,0.8)",
        color: "#e5e7eb",
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <span>{authNotice}</span>
      <button
        type="button"
        onClick={() => setAuthNotice("")}
        style={{
          border: "none",
          background: "transparent",
          color: "#e5e7eb",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 4,
        }}
        aria-label="Hinweis schließen"
      >
        ×
      </button>
    </div>
  );
}
