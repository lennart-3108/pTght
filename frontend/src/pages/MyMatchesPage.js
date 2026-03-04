import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import { useLanguage } from "../i18n";

/**
 * MyMatchesPage – Overview of all the logged-in user's matches,
 * split into "Anstehend" (upcoming / result_pending) and "Abgeschlossen" (completed).
 * Follows the Match League dark-green / gold design language.
 */
export default function MyMatchesPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const token = localStorage.getItem("token");

  const [upcoming, setUpcoming] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming"); // "upcoming" | "completed"

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadMatches() {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${API_BASE}/me/games`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) { navigate("/login"); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setUpcoming(Array.isArray(data.upcoming) ? data.upcoming : []);
      setCompleted(Array.isArray(data.completed) ? data.completed : []);
    } catch (err) {
      setError(err.message || t("myMatches.loadError"));
    } finally {
      setLoading(false);
    }
  }

  /* ---------- helpers ---------- */

  function formatDate(val) {
    if (!val) return "–";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "–";
    return d.toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  }

  function formatTime(val) {
    if (!val) return "";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function statusBadge(match) {
    const s = (match.status || "").toLowerCase();
    if (s === "result_pending") return { label: t("myMatches.statusPending"), color: "#d4af37" };
    if (s === "result_disputed") return { label: t("myMatches.statusDisputed"), color: "#dc2626" };
    if (s === "completed") return { label: t("myMatches.statusCompleted"), color: "#22c55e" };
    if (s === "cancelled") return { label: t("myMatches.statusCancelled"), color: "#9ca3af" };
    if (s === "scheduled" || s === "open" || s === "confirmed") return { label: t("myMatches.statusScheduled"), color: "#38bdf8" };
    return { label: s || "–", color: "#6b7280" };
  }

  function scoreDisplay(match) {
    if (match.home_score == null || match.away_score == null) return null;
    return `${match.home_score} : ${match.away_score}`;
  }

  /* ---------- render ---------- */

  const visibleMatches = tab === "upcoming" ? upcoming : completed;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>{t("myMatches.loading")}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>{t("myMatches.title")}</h1>
        <button onClick={() => navigate("/match-search")} style={styles.newMatchBtn}>
          + {t("myMatches.findMatch")}
        </button>
      </div>

      {error && (
        <div style={styles.error}>
          {error}
          <button onClick={() => setError("")} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setTab("upcoming")}
          style={{ ...styles.tabBtn, ...(tab === "upcoming" ? styles.tabBtnActive : {}) }}
        >
          {t("myMatches.upcoming")} ({upcoming.length})
        </button>
        <button
          onClick={() => setTab("completed")}
          style={{ ...styles.tabBtn, ...(tab === "completed" ? styles.tabBtnActive : {}) }}
        >
          {t("myMatches.completed")} ({completed.length})
        </button>
      </div>

      {/* Match list */}
      {visibleMatches.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ color: "#9ca3af", margin: 0 }}>
            {tab === "upcoming" ? t("myMatches.noUpcoming") : t("myMatches.noCompleted")}
          </p>
          {tab === "upcoming" && (
            <button onClick={() => navigate("/match-search")} style={styles.findNowBtn}>
              {t("myMatches.findMatch")}
            </button>
          )}
        </div>
      ) : (
        <div style={styles.list}>
          {visibleMatches.map((m) => {
            const badge = statusBadge(m);
            const score = scoreDisplay(m);
            return (
              <div
                key={m.id}
                style={styles.card}
                onClick={() => navigate(`/matches/${m.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") navigate(`/matches/${m.id}`); }}
              >
                <div style={styles.cardTop}>
                  <div style={styles.cardMeta}>
                    {m.sport && <span style={styles.sportTag}>{m.sport}</span>}
                    {m.league && <span style={styles.leagueTag}>{m.league}</span>}
                  </div>
                  <span style={{ ...styles.statusBadge, background: badge.color }}>
                    {badge.label}
                  </span>
                </div>

                <div style={styles.matchup}>
                  <span style={styles.playerName}>{m.home || "–"}</span>
                  {score ? (
                    <span style={styles.score}>{score}</span>
                  ) : (
                    <span style={styles.vs}>vs</span>
                  )}
                  <span style={styles.playerName}>{m.away || "–"}</span>
                </div>

                <div style={styles.cardBottom}>
                  <span style={styles.dateText}>
                    {formatDate(m.kickoff_at)}
                    {formatTime(m.kickoff_at) ? ` · ${formatTime(m.kickoff_at)}` : ""}
                  </span>
                  {m.city && <span style={styles.cityText}>{m.city}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- styles (ML dark-green / gold design) ---------- */
const styles = {
  container: {
    maxWidth: 800,
    margin: "0 auto",
    padding: "24px 16px 60px",
    fontFamily: "'Inter', 'Roboto', sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12,
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    color: "#e5e7eb",
    letterSpacing: "-0.3px",
  },
  newMatchBtn: {
    padding: "10px 20px",
    border: "none",
    borderRadius: 8,
    background: "#d4af37",
    color: "#0f2a20",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tabs: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
    borderBottom: "1px solid #374151",
    paddingBottom: 0,
  },
  tabBtn: {
    flex: 1,
    padding: "12px 0",
    border: "none",
    borderBottom: "3px solid transparent",
    background: "transparent",
    color: "#9ca3af",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "color 0.2s, border-color 0.2s",
    textAlign: "center",
  },
  tabBtnActive: {
    color: "#d4af37",
    borderBottomColor: "#d4af37",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    background: "#111827",
    border: "1px solid #1f2937",
    borderRadius: 12,
    padding: "16px 20px",
    cursor: "pointer",
    transition: "border-color 0.2s, transform 0.15s",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardMeta: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  sportTag: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    color: "#d4af37",
    background: "rgba(212,175,55,0.12)",
    padding: "3px 8px",
    borderRadius: 4,
  },
  leagueTag: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    background: "rgba(156,163,175,0.1)",
    padding: "3px 8px",
    borderRadius: 4,
  },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: 6,
    color: "#0f2a20",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  matchup: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    margin: "8px 0 12px",
  },
  playerName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#e5e7eb",
    flex: 1,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  vs: {
    fontSize: 13,
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    flexShrink: 0,
  },
  score: {
    fontSize: 20,
    fontWeight: 700,
    color: "#d4af37",
    flexShrink: 0,
    letterSpacing: 1,
  },
  cardBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #1f2937",
    paddingTop: 10,
  },
  dateText: {
    fontSize: 13,
    color: "#9ca3af",
  },
  cityText: {
    fontSize: 13,
    color: "#6b7280",
    fontStyle: "italic",
  },
  emptyState: {
    textAlign: "center",
    padding: 60,
    background: "#111827",
    borderRadius: 12,
    border: "1px solid #1f2937",
  },
  findNowBtn: {
    marginTop: 20,
    padding: "12px 24px",
    border: "none",
    borderRadius: 8,
    background: "#d4af37",
    color: "#0f2a20",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  loading: {
    textAlign: "center",
    padding: 40,
    fontSize: 16,
    color: "#9ca3af",
  },
  error: {
    position: "relative",
    marginBottom: 20,
    padding: 16,
    background: "#7f1d1d",
    color: "#fecaca",
    borderRadius: 8,
    border: "1px solid #dc2626",
  },
  errorClose: {
    position: "absolute",
    top: 12,
    right: 12,
    border: "none",
    background: "transparent",
    fontSize: 18,
    cursor: "pointer",
    color: "#fecaca",
  },
};
