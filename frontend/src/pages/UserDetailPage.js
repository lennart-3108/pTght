import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config";

export default function UserDetailPage() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");

    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("token");
        const [userRes, leaguesRes, gamesRes] = await Promise.all([
          fetch(`${API_BASE}/users/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/users/${id}/leagues`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_BASE}/users/${id}/games`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!userRes.ok) throw new Error(`User not found (HTTP ${userRes.status})`);
        if (!leaguesRes.ok) throw new Error(`Leagues not found (HTTP ${leaguesRes.status})`);
        if (!gamesRes.ok) throw new Error(`Games not found (HTTP ${gamesRes.status})`);

        const userData = await userRes.json();
        const leaguesData = await leaguesRes.json();
        const gamesData = await gamesRes.json();

        if (mounted) {
          setUser(userData);
          setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
          setGames(Array.isArray(gamesData) ? gamesData : []);
        }
      } catch (e) {
        if (mounted) setErr(e.message || "Fehler beim Laden der Benutzerdaten.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUserData();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div style={{ padding: 16 }}>Lade Benutzerdaten...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!user) return <div style={{ padding: 16 }}>Benutzer nicht gefunden.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h2>Benutzerprofil</h2>
      <div><b>Name:</b> {user.firstname} {user.lastname}</div>
      <div><b>E-Mail:</b> {user.email}</div>

      <h3 style={{ marginTop: 16 }}>Ligen</h3>
      {leagues.length === 0 ? (
        <div>Keine Ligen gefunden.</div>
      ) : (
        <ul>
          {leagues.map(l => (
            <li key={l.id}>{l.name}</li>
          ))}
        </ul>
      )}

      <h3 style={{ marginTop: 16 }}>Spiele</h3>
      {games.length === 0 ? (
        <div>Keine Spiele gefunden.</div>
      ) : (
        <ul>
          {games.map(g => (
            <li key={g.id}>{g.home} vs {g.away}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
