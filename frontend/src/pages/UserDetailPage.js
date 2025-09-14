import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE } from "../config";

export default function UserDetailPage() {
  const { id } = useParams();
  console.log("User ID from URL:", id); // Debugging-Log hinzufügen

  const [user, setUser] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) {
      console.error("User ID is undefined. Cannot fetch data.");
      setErr("Ungültige Benutzer-ID.");
      setLoading(false);
      return;
    }

    console.log("Fetching data for user ID:", id);

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

        // Log detailed responses for debugging
        console.log("User response:", userRes);
        console.log("Leagues response:", leaguesRes);
        console.log("Games response:", gamesRes);

        if (!userRes.ok) {
          const errorText = await userRes.text();
          throw new Error(`User not found (HTTP ${userRes.status}): ${errorText}`);
        }
        if (!leaguesRes.ok) {
          const errorText = await leaguesRes.text();
          throw new Error(`Leagues not found (HTTP ${leaguesRes.status}): ${errorText}`);
        }
        if (!gamesRes.ok) {
          const errorText = await gamesRes.text();
          throw new Error(`Games not found (HTTP ${gamesRes.status}): ${errorText}`);
        }

        const userData = await userRes.json();
        const leaguesData = await leaguesRes.json();
        const gamesData = await gamesRes.json();

        if (mounted) {
          setUser(userData);
          setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
          setGames(Array.isArray(gamesData) ? gamesData : []);
        }
      } catch (e) {
        console.error("Error fetching user data:", e.message || e);
        if (mounted) setErr(e.message || "Fehler beim Laden der Benutzerdaten.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchUserData();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE}/users/${id}/leagues`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Leagues response:", response);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Error fetching leagues: ${errorText}`); // Fehlerprotokollierung
          throw new Error(`Leagues not found (HTTP ${response.status}): ${errorText}`);
        }

        const leaguesData = await response.json();
        setLeagues(Array.isArray(leaguesData) ? leaguesData : []);
      } catch (e) {
        console.error("Error fetching leagues:", e.message || e);
        setErr(e.message || "Fehler beim Laden der Ligen.");
      }
    };

    fetchLeagues();
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
