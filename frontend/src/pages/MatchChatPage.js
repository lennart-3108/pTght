import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import MatchChat from "../components/MatchChat";

export default function MatchChatPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  return (
    <div style={{
      maxWidth: 800,
      margin: '0 auto',
      padding: 20
    }}>
      {/* Header mit Zurück-Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
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
        <h1 style={{ margin: 0, fontSize: 24 }}>Match-Chat</h1>
      </div>

      {/* Match-Chat Komponente */}
      <MatchChat matchId={matchId} token={token} />
    </div>
  );
}
