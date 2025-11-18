import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import Avatar from "../components/Avatar";
import { handleInvalidToken } from "../utils/auth";

export default function SportsDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sport, setSport] = useState(null);
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr("");

    const normalize = (l) => ({
      id: l.id,
      name: l.name,
      cityId: l.cityId ?? l.city_id ?? l.cityID,
      sportId: l.sportId ?? l.sport_id ?? l.sportID,
      city: l.city ?? l.city_name ?? l.cityName ?? "",
    });

    Promise.all([
      fetch(`${API_BASE}/sports/${id}`).then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
      fetch(`${API_BASE}/sports/${id}/leagues`).then(r => (r.ok ? r.json() : []))
    ])
      .then(([s, ls]) => {
        if (!mounted) return;
        setSport(s);
        setLeagues(Array.isArray(ls) ? ls.map(normalize) : []);
      })
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [id]);

  const wrap = { padding: 16, color: '#e8efe8', fontFamily: 'Inter, system-ui, sans-serif' };
  const card = { background: '#0f2a20', borderRadius: 16, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' };
  const pad = { padding: 16 };
  const pill = { display: 'inline-block', padding: '6px 12px', borderRadius: 999, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' };
  const small = { fontSize: 12, color: '#a6bfb3' };

  const counts = useMemo(() => ({
    activeLeagues: leagues.length,
    activePlayers: null, // optional: could be aggregated via /leagues/:id/members
    runningSeasons: null,
  }), [leagues]);

  if (loading) return <div style={{ padding: 16 }}>Lade Sportart ...</div>;
  if (err) {
    if (handleInvalidToken(err, navigate)) return null;
    return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  }
  if (!sport) return <div style={{ padding: 16 }}>Keine Daten.</div>;

  const title = sport.name || 'Sport';
  const emoji = title.toLowerCase().includes('fuß') || title.toLowerCase().includes('fuss') ? '⚽️' : '🏅';

  return (
    <div style={wrap}>
      {/* Header */}
      <div style={{ ...card }}>
        <div style={{ ...pad, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>{emoji}</div>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0.5 }}>{title}</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, color: '#cfe' }}>
            <div>{counts.activeLeagues} aktive Ligen</div>
            {counts.activePlayers != null && <div>{counts.activePlayers} aktive Spieler</div>}
            {counts.runningSeasons != null && <div>{counts.runningSeasons} laufende Saisons</div>}
          </div>
        </div>
      </div>

      {/* Aktive Ligen */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Aktive Ligen</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          {leagues.length === 0 ? (
            <div style={small}>Keine Ligen für diese Sportart.</div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {leagues.map(l => (
                <div key={l.id} style={{ background: '#0b1e19', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>{l.name}</div>
                    <div style={small}><span style={{ color: '#8fd' }}>● Aktiv</span>{l.city ? ` · ${l.city}` : ''}</div>
                  </div>
                  <Link to={`/league/${l.id}`} style={pill}>Liga ansehen</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top-Spieler – Placeholder */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Top‑Spieler im {title}</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          <div style={{ display: 'grid', gap: 10 }}>
            {[{"name":"Max Schröder","points":132},{"name":"Nico Hartmann","points":121},{"name":"Jonas Berger","points":115}].map((u, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 12, background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                <Avatar userId={null} name={u.name} size={40} />
                <div style={{ fontWeight: 700 }}>{u.name}</div>
                <div style={{ color: '#9db' }}>{u.points}</div>
                <button style={pill} disabled>Profil ansehen</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer KPIs – placeholder */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>1,284</div>
            <div style={{ color: '#bcd' }}>Gesamtspiele</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>3,412</div>
            <div style={{ color: '#bcd' }}>Gesamttore</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900 }}>2,9</div>
            <div style={{ color: '#bcd' }}>Pro Spiel</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Link to="/sports">← Zurück zu Sportarten</Link>
      </div>
    </div>
  );
}
