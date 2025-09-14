import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function UserDetailPage() {
  const { userId } = useParams();
  const [u, setU] = useState(null);
  const [err, setErr] = useState("");
  const token = localStorage.getItem("token");

  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [selLeague, setSelLeague] = useState("");
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  useEffect(() => {
    let mounted = true;
    setErr("");
    const apiBase = process.env.REACT_APP_API_BASE || "http://localhost:5001";  // Neu: ENV für API-Base
    fetch(`${apiBase}/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => mounted && setU(j))
      .catch(e => mounted && setErr(e.message || "Fehler"));
    return () => { mounted = false; };
  }, [userId, token]);

  useEffect(() => {
    let mounted = true;
    const apiBase = process.env.REACT_APP_API_BASE || "http://localhost:5001";  // Neu: ENV für API-Base
    // Ligen des Users
    fetch(`${apiBase}/users/${userId}/leagues`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => (r.ok ? r.json() : []))
      .then(j => mounted && setLeagues(Array.isArray(j) ? j : []))
      .catch(() => mounted && setLeagues([]));
    // Spiele des Users
    fetch(`${apiBase}/users/${userId}/games`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => (r.ok ? r.json() : { upcoming: [], completed: [] }))
      .then(j => mounted && setGames({ upcoming: j.upcoming || [], completed: j.completed || [] }))
      .catch(() => mounted && setGames({ upcoming: [], completed: [] }));
    return () => { mounted = false; };
  }, [userId, token]);
}
