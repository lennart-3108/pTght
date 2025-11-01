import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../config";
import AvatarEditor from "react-avatar-editor";

export default function ProfilePage() {
  const [data, setData] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [profile, setProfile] = useState({ open_for_matches: false, favorite_sports: [] });
  const [leagues, setLeagues] = useState([]);
  const [games, setGames] = useState({ upcoming: [], completed: [] });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [locationLoading, setLocationLoading] = useState(false);
  // Location confirmation state
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [showLocationBanner, setShowLocationBanner] = useState(true);
  // avatar cropper state
  const [cropSrc, setCropSrc] = useState(null);
  const [cropScale, setCropScale] = useState(1.2);
  const [cropPos, setCropPos] = useState({ x: 0.5, y: 0.5 });
  const editorRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setErr("");
    setLoading(true);
    const token = localStorage.getItem("token");

    fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        return j;
      })
      .then(async (j) => {
        if (!mounted) return;
        setData(j);
        // Try to load full user (to get avatar_url if present)
        try {
          const r2 = await fetch(`${API_BASE}/users/${j.id}`, { headers: { Authorization: `Bearer ${token}` } });
          const u = await r2.json().catch(() => ({}));
          if (u && u.avatar_url) {
            let url = String(u.avatar_url || '');
            
            // Fix hardcoded localhost:5002 references
            if (url.includes('localhost:5002')) {
              const match = url.match(/\/uploads\/avatars\/[^?#]+/);
              if (match) url = match[0];
            }
            
            const abs = /^(https?:)?\/\//i.test(url)
              ? url
              : `${API_BASE.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
            setAvatarUrl(abs);
          }
        } catch {}
      })
      .catch(e => mounted && setErr(e.message || "Fehler"))
      .finally(() => mounted && setLoading(false));

    // load profile preferences
    fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { open_for_matches: false, favorite_sports: [], location: null })
      .then(j => mounted && setProfile({
        open_for_matches: !!j.open_for_matches,
        favorite_sports: Array.isArray(j.favorite_sports) ? j.favorite_sports : [],
        location: j.location || null
      }))
      .catch(() => {});

    fetch(`${API_BASE}/me/leagues`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(j => mounted && setLeagues(Array.isArray(j) ? j : []))
      .catch(() => {});

    fetch(`${API_BASE}/me/games`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : { upcoming: [], completed: [] }))
      .then(j => mounted && setGames({
        upcoming: Array.isArray(j.upcoming) ? j.upcoming : [],
        completed: Array.isArray(j.completed) ? j.completed : []
      }))
      .catch(() => {});

    return () => { mounted = false; };
  }, []);

  async function safeNavigateTo(e, href, apiPath) {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}${apiPath}`, { method: "GET" });
      if (res.ok) {
        navigate(href);
      } else {
        const txt = await res.text().catch(() => "");
        alert(`Seite vorübergehend nicht erreichbar (${res.status}).\n${txt ? txt.slice(0,200) : ""}`);
      }
    } catch (err) {
      alert("Fehler beim Aufrufen der Seite: " + (err.message || err));
    }
  }

  if (loading) return <div style={{ padding: 16 }}>Lade Profil ...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Fehler: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>Keine Daten.</div>;

  // Handler to detect and confirm location
  const detectLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation wird von deinem Browser nicht unterstützt');
      return;
    }

    setLocationLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      setDetectedLocation({ latitude, longitude });
      setShowLocationConfirm(true);
      setLocationLoading(false);
    } catch (error) {
      console.error('Location detection error:', error);
      alert('Standort konnte nicht ermittelt werden: ' + (error.message || 'Berechtigung verweigert oder Timeout'));
      setLocationLoading(false);
    }
  };

  // Handler to save location after confirmation
  const saveLocation = async () => {
    if (!detectedLocation) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(detectedLocation)
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern des Standorts');
      }

      const updated = await response.json();
      setData(updated);
      setShowLocationConfirm(false);
      setShowLocationBanner(false);
      setDetectedLocation(null);
      alert('Standort erfolgreich gespeichert!');
    } catch (error) {
      console.error('Location save error:', error);
      alert('Standort konnte nicht gespeichert werden: ' + (error.message || 'Unbekannter Fehler'));
    }
  };

  // Handler to update location (existing)
  const updateLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation wird von deinem Browser nicht unterstützt');
      return;
    }

    setLocationLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const { latitude, longitude } = position.coords;
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_BASE}/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ latitude, longitude })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Aktualisieren des Standorts');
      }

      const updated = await response.json();
      setData(updated);
      alert('Standort erfolgreich aktualisiert!');
    } catch (error) {
      console.error('Location update error:', error);
      alert('Standort konnte nicht aktualisiert werden: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
      setLocationLoading(false);
    }
  };

  // UI helpers
  const wrap = { padding: 16, color: '#e8efe8', fontFamily: 'Inter, system-ui, sans-serif' };
  const card = { background: '#0f2a20', borderRadius: 16, boxShadow: '0 14px 36px rgba(0,0,0,0.5)' };
  const pad = { padding: 16 };
  const pill = { display: 'inline-block', padding: '4px 10px', borderRadius: 999, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' };
  const small = { fontSize: 12, color: '#a6bfb3' };
  const hRow = { display: 'flex', alignItems: 'center', gap: 12 };

  // Group leagues by sport text
  const leaguesBySport = leagues.reduce((m, l) => {
    const key = (l.sport || 'Andere').trim();
    (m[key] = m[key] || []).push(l);
    return m;
  }, {});

  // Compute summary stats for header based on completed games
  const myId = data?.id;
  const completed = Array.isArray(games?.completed) ? games.completed : [];
  const myCompleted = completed.filter(g => (
    (g.home_user_id && String(g.home_user_id) === String(myId)) ||
    (g.away_user_id && String(g.away_user_id) === String(myId)) ||
    (!g.home_user_id && !g.away_user_id) // text-only schemas – include but stats may be ambiguous
  ));
  let wins = 0, losses = 0, draws = 0;
  for (const g of myCompleted) {
    const hs = Number(g.home_score);
    const as = Number(g.away_score);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) continue;
    if (g.home_user_id && String(g.home_user_id) === String(myId)) {
      if (hs > as) wins++; else if (hs < as) losses++; else draws++;
    } else if (g.away_user_id && String(g.away_user_id) === String(myId)) {
      if (as > hs) wins++; else if (as < hs) losses++; else draws++;
    } else {
      // text schema fallback: try by name
      const meName = `${data?.firstname || ''} ${data?.lastname || ''}`.trim();
      if (g.home === meName) { if (hs > as) wins++; else if (hs < as) losses++; else draws++; }
      else if (g.away === meName) { if (as > hs) wins++; else if (as < hs) losses++; else draws++; }
    }
  }
  const matchesCount = myCompleted.length;

  const GameList = ({ title, items, showScore }) => (
    <div style={{ ...card, marginTop: 16 }}>
      <div style={{ ...pad, paddingBottom: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      </div>
      <div style={{ ...pad, paddingTop: 8 }}>
        {items.length === 0 ? (
          <div style={small}>Keine {title.toLowerCase()}.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map(g => (
              <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', alignItems: 'center', gap: 10, background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.league}</div>
                  <div style={small}>{new Date(g.kickoff_at || Date.now()).toLocaleString('de-DE')}</div>
                </div>
                <div style={{ textAlign: 'right', color: '#9db' }}>{g.home}</div>
                <div style={{ textAlign: 'center', fontWeight: 700 }}>
                  {showScore ? (
                    <span>{g.home_score != null && g.away_score != null ? `${g.home_score}:${g.away_score}` : '— : —'}</span>
                  ) : (
                    <span>VS</span>
                  )}
                </div>
                <div style={{ color: '#9db' }}>{g.away}</div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  <Link to={`/matches/${g.id}`} style={pill}>Details</Link>
                  <Link to={`/matches/${g.id}`} style={pill}>Match-Chat</Link>
                  {!showScore && <Link to={`/matches/${g.id}`} style={pill}>Termin ändern</Link>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={wrap}>
      {/* Location Banner - show if no location is set */}
      {showLocationBanner && !profile.location && !data.latitude && !data.longitude && (
        <div style={{
          background: 'linear-gradient(135deg, #2d5a4a 0%, #195642 100%)',
          border: '1px solid #2f6b57',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              📍 Standort nicht festgelegt
            </div>
            <div style={{ fontSize: 14, color: '#bcd' }}>
              Erlauben Sie den Zugriff auf Ihren Standort, um lokale Matches und Ligen zu finden.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={detectLocation}
              disabled={locationLoading}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: locationLoading ? '#0e2521' : '#debc7c',
                color: '#0a2221',
                cursor: locationLoading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              {locationLoading ? '⌛ Ermittle...' : '📍 Lokalisiere mich'}
            </button>
            <button
              onClick={() => setShowLocationBanner(false)}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#e8efe8',
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Location Confirmation Modal */}
      {showLocationConfirm && detectedLocation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#0f2a20',
            border: '1px solid #2f6b57',
            borderRadius: 14,
            width: 'min(92vw, 480px)',
            maxWidth: '100%',
            padding: 24,
            color: '#e8efe8'
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              📍 Standort erkannt
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, color: '#a6bfb3', marginBottom: 12 }}>
                Ihr Standort wurde erfolgreich ermittelt:
              </div>
              <div style={{
                background: '#0b1e19',
                borderRadius: 8,
                padding: 12,
                fontFamily: 'monospace',
                fontSize: 13
              }}>
                <div>Breitengrad: {detectedLocation.latitude.toFixed(6)}</div>
                <div>Längengrad: {detectedLocation.longitude.toFixed(6)}</div>
              </div>
            </div>
            <div style={{ fontSize: 14, marginBottom: 20, color: '#bcd' }}>
              Möchten Sie diesen Standort in Ihrem Profil speichern? 
              Dies hilft uns, Ihnen relevante Matches und Ligen in Ihrer Nähe anzuzeigen.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowLocationConfirm(false);
                  setDetectedLocation(null);
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid #2f6b57',
                  background: 'transparent',
                  color: '#e8efe8',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                Nein, abbrechen
              </button>
              <button
                onClick={saveLocation}
                style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#debc7c',
                  color: '#0a2221',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700
                }}
              >
                Ja, speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with avatar, name, role, sport badges and stats summary */}
      <div style={{ ...card, paddingBottom: 0 }}>
        <div style={{ ...pad, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <img
            alt="avatar"
            src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent((data.firstname||'')+' '+(data.lastname||''))}&backgroundType=gradientLinear&fontWeight=700`}
            style={{ width: 80, height: 80, borderRadius: 80, objectFit: 'cover', background: '#1b3a31' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{data.firstname} {data.lastname}</div>
            <div style={small}>Einzelspieler</div>
            {(profile.location || (data.latitude && data.longitude)) && (
              <div style={{...small, marginTop: 4}}>
                📍 {profile.location && <span style={{ fontWeight: 600 }}>{profile.location}</span>}
                {profile.location && (data.latitude || data.longitude) && <span> · </span>}
                {data.latitude && data.longitude && (
                  <span style={{ color: '#9ca3af' }}>
                    {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
                  </span>
                )}
                {data.location_updated_at && (
                  <span> · Aktualisiert: {new Date(data.location_updated_at).toLocaleDateString('de-DE')}</span>
                )}
              </div>
            )}
          </div>
          {/* Avatar upload with cropper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'column' }}>
            <button
              onClick={() => navigate('/profile/edit')}
              style={{ 
                padding: '8px 16px', 
                borderRadius: 8, 
                border: '1px solid #2f6b57', 
                background: '#113528', 
                color: '#e8efe8', 
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                width: '100%'
              }}
            >
              Bearbeiten
            </button>
            <button
              onClick={updateLocation}
              disabled={locationLoading}
              style={{ 
                padding: '8px 16px', 
                borderRadius: 8, 
                border: '1px solid #2f6b57', 
                background: locationLoading ? '#0e2521' : '#113528', 
                color: '#e8efe8', 
                cursor: locationLoading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                width: '100%'
              }}
            >
              {locationLoading ? '📍 Lädt...' : '📍 Standort aktualisieren'}
            </button>
            <label style={{ ...pill, cursor: 'pointer', background: '#143329' }}>
              Bild wählen
              <input
                type="file"
                accept="image/png, image/jpeg"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setCropSrc(reader.result);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {/* Sport-Badges (Text, komma-getrennt) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.keys(leaguesBySport).map((s) => (
              <span key={s} style={{ ...pill, background: '#143329' }}>{s}</span>
            ))}
          </div>
        </div>
        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: 16 }}>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{wins}</div>
            <div style={{ color: '#bcd' }}>Siege</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{losses}</div>
            <div style={{ color: '#bcd' }}>Niederlagen</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{draws}</div>
            <div style={{ color: '#bcd' }}>Unentschieden</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px' }}>
            <div style={{ fontSize: 34, fontWeight: 900 }}>{matchesCount}</div>
            <div style={{ color: '#bcd' }}>Matches</div>
          </div>
        </div>
      </div>

      {/* Meine Ligen – gruppiert nach Sport (ohne Logos, nur Text) */}
      <div style={{ ...card, marginTop: 16 }}>
        <div style={{ ...pad, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Meine Ligen</div>
          <div style={small}>Stadt und Sport als Text – mehrere Sportarten werden durch Badges oben angezeigt.</div>
        </div>
        <div style={{ ...pad, paddingTop: 8 }}>
          {leagues.length === 0 ? (
            <div style={small}>Keine Ligen.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {leagues.map((l) => {
                const leagueHref = l.leagueUrl || (l.id ? `/league/${l.id}` : null);
                const cityHref = l.cityUrl || (l.cityId ? `/cities/${l.cityId}` : null);
                return (
                  <div key={String(l.id || l.leagueId || Math.random())} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b1e19', borderRadius: 12, padding: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{l.name || l.league || '—'}</div>
                      <div style={small}>{[l.sport, l.city].filter(Boolean).join(' · ')}</div>
                      {l.joined_at && <div style={small}>Beigetreten: {new Date(l.joined_at).toLocaleDateString('de-DE')}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {leagueHref && <a href={leagueHref} onClick={(e) => safeNavigateTo(e, leagueHref, `/leagues/${l.id || l.leagueId}`)} style={pill}>Zur Liga</a>}
                      {cityHref && <a href={cityHref} onClick={(e) => safeNavigateTo(e, cityHref, `/cities/${l.cityId}`)} style={pill}>Zur Stadt</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Spiel-Listen (ensure distinct arrays) */}
      <GameList title="Kommende Spiele" items={(games.upcoming || []).filter(g => g.home_score == null && g.away_score == null)} showScore={false} />
      <GameList title="Vergangene Spiele" items={(games.completed || []).filter(g => g.home_score != null && g.away_score != null)} showScore={true} />

      {/* Avatar cropper modal */}
      <Modal open={!!cropSrc} onClose={() => setCropSrc(null)}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Avatar zuschneiden</div>
          <div style={{ display: 'grid', justifyItems: 'center' }}>
            {cropSrc && (
              <AvatarEditor
                image={cropSrc}
                ref={editorRef}
                width={300}
                height={300}
                border={0}
                borderRadius={150}
                color={[0, 0, 0, 0.4]}
                scale={cropScale}
                position={cropPos}
                onPositionChange={setCropPos}
                style={{ borderRadius: 150, background: '#0b1e19', boxShadow: '0 0 0 2px #2f6b57 inset' }}
              />
            )}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label style={{ fontSize: 12, color: '#a6bfb3' }}>Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={cropScale}
              onChange={(e) => setCropScale(parseFloat(e.target.value) || 1)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => setCropSrc(null)}
              style={{ ...{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#0e2a22', color: '#dfe' } }}
            >Abbrechen</button>
            <button
              onClick={async () => {
                try {
                  const ed = editorRef.current;
                  if (!ed) return;
                  // Export square 512x512
                  const out = ed.getImageScaledToCanvas();
                  // Draw onto fixed 512 canvas
                  const canvas = document.createElement('canvas');
                  canvas.width = 512; canvas.height = 512;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(out, 0, 0, 512, 512);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                  const token = localStorage.getItem('token');
                  const resp = await fetch(`${API_BASE}/users/${data.id}/avatar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ image: dataUrl })
                  });
                  const j = await resp.json().catch(() => ({}));
                  if (!resp.ok || !j.ok) {
                    if (resp.status === 413 || j.error === 'PAYLOAD_TOO_LARGE') {
                      throw new Error('Bild ist zu groß. Bitte kleiner hochladen.');
                    }
                    throw new Error(j.error || `HTTP ${resp.status}`);
                  }
                  // cache-bust so the freshly uploaded file displays immediately
                  const raw = String(j.url || '');
                  const abs = /^(https?:)?\/\//i.test(raw)
                    ? raw
                    : `${API_BASE.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
                  const bust = `${abs}${abs.includes('?') ? '&' : '?'}t=${Date.now()}`;
                  setAvatarUrl(bust);
                  setCropSrc(null);
                } catch (e) {
                  alert('Upload fehlgeschlagen: ' + (e.message || e));
                }
              }}
              style={{ ...{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, border: '1px solid #2f6b57', background: '#195642', color: '#dfe' } }}
            >Als Avatar speichern</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Simple modal component
function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: '#0f2a20', border: '1px solid #2f6b57', borderRadius: 14, width: 'min(92vw, 560px)', maxWidth: '100%', padding: 16, color: '#e8efe8' }}>
        {children}
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#9db', cursor: 'pointer' }}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

