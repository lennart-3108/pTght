import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import MatchChat from "../components/MatchChat";

export default function MatchChatPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [matchInfo, setMatchInfo] = useState(null);

  function formatDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  const info = matchInfo;
  const team1 = info?.participants?.filter(p => p.teamIndex === 1) || [];
  const team2 = info?.participants?.filter(p => p.teamIndex === 2) || [];
  const noTeamIndex = info?.participants?.filter(p => p.teamIndex == null) || [];
  const hasTeams = team1.length > 0 || team2.length > 0;

  let playersLabel = '';
  if (hasTeams) {
    playersLabel = (team1.map(p => p.name).join(', ') || '?') + '  vs  ' + (team2.map(p => p.name).join(', ') || '?');
  } else if (noTeamIndex.length) {
    playersLabel = noTeamIndex.map(p => p.name).join(' vs ');
  }

  const dateLabel = info?.kickoffAt ? formatDate(info.kickoffAt) : (info?.kickoffEndAt ? ('bis ' + formatDate(info.kickoffEndAt)) : null);
  const sportLabel = [info?.sportName, info?.leagueName].filter(Boolean).join(' · ');
  const scoreLabel = info?.homeScore != null && info?.awayScore != null ? `${info.homeScore} : ${info.awayScore}` : null;

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: 20
    }}>
      {/* Header mit Zurück-Button und Zum Match */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 20
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '8px 16px',
            background: 'rgba(47, 107, 87, 0.2)',
            border: '1px solid rgba(47, 107, 87, 0.4)',
            borderRadius: 8,
            color: '#9db',
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          ← Zurück
        </button>
        <h1 style={{ margin: 0, fontSize: 24, flex: 1 }}>Match-Chat</h1>
        <Link
          to={`/matches/${matchId}`}
          style={{
            padding: '8px 16px',
            background: 'rgba(47, 107, 87, 0.3)',
            border: '1px solid rgba(47, 107, 87, 0.5)',
            borderRadius: 8,
            color: '#c5e8d4',
            cursor: 'pointer',
            fontSize: 14,
            textDecoration: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
        >
          Zum Match →
        </Link>
      </div>

      {/* Match Info Header */}
      {info && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(15, 36, 29, 0.8)',
          border: '1px solid rgba(47, 107, 87, 0.35)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          {sportLabel && (
            <div style={{ fontSize: 13, color: '#debc7c', fontWeight: 600 }}>
              {sportLabel}
            </div>
          )}
          {playersLabel && (
            <div style={{ fontSize: 15, color: '#f0fff6', fontWeight: 600 }}>
              {playersLabel}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {dateLabel && (
              <span style={{ fontSize: 13, color: '#9db' }}>📅 {dateLabel}</span>
            )}
            {scoreLabel && (
              <span style={{ fontSize: 14, color: '#c5e8d4', fontWeight: 700, background: 'rgba(47, 107, 87, 0.3)', padding: '2px 10px', borderRadius: 6 }}>
                {scoreLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Match-Chat Komponente */}
      <MatchChat matchId={matchId} token={token} onMetaLoaded={setMatchInfo} />
    </div>
  );
}
