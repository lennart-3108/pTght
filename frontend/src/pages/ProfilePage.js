import React, { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "../i18n";

function extractUserIdFromToken(token) {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    const rawId = payload?.user?.id ?? payload?.userId ?? payload?.sub ?? payload?.id ?? null;
    const numeric = Number(rawId);
    return Number.isFinite(numeric) ? numeric : null;
  } catch {
    return null;
  }
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const myUserId = useMemo(() => extractUserIdFromToken(token), [token]);

  useEffect(() => {
    if (!myUserId) return;
    navigate(`/user/${myUserId}`, { replace: true });
  }, [myUserId, navigate]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }}>{t('profile.title')}</div>
      <div style={{ color: "#9ca3af" }}>
        {t('profile.errorOpen')}
      </div>
      <div style={{ marginTop: 12 }}>
        <Link to="/start" style={{ color: "#48baa6", textDecoration: "none", fontWeight: 700 }}>
          {t('profile.toStart')}
        </Link>
      </div>
    </div>
  );
}
