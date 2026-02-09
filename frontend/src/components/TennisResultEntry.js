import React, { useState, useEffect } from 'react';
import Counter from './Counter';

/**
 * Tennis Result Entry Component
 * Handles set-based scoring for tennis matches
 * 
 * Props:
 * - ruleset: { config: { sets_to_win, max_sets, allow_tiebreak, ... } }
 * - isOpenMatch: boolean - if true, allows free-form entry
 * - onResultChange: (result) => void - callback with { home_score, away_score, sets, aborted, abort_reason, abort_by }
 * - disabled: boolean
 * - isMobile: boolean
 * - numSets: number - controlled number of sets (optional, defaults to ruleset config)
 */
export default function TennisResultEntry({ 
  ruleset, 
  isOpenMatch = false, 
  onResultChange,
  disabled = false,
  isMobile = false,
  numSets: externalNumSets
}) {
  // State for sets - use external numSets if provided
  const [numSets, setNumSets] = useState(externalNumSets || (isOpenMatch ? 1 : (ruleset?.config?.max_sets || 3)));
  const [sets, setSets] = useState([{ home: 0, away: 0 }]);
  const [aborted, setAborted] = useState(false);
  const [abortReason, setAbortReason] = useState('');
  const [abortBy, setAbortBy] = useState('home'); // 'home' or 'away'
  
  // Simple scores for single-set mode
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  
  // Calculate scores based on sets won
  const calculateScores = (currentSets) => {
    let homeWon = 0;
    let awayWon = 0;
    
    currentSets.forEach(set => {
      if (set.home > set.away) homeWon++;
      else if (set.away > set.home) awayWon++;
    });
    
    return { home_score: homeWon, away_score: awayWon };
  };
  
  // Sync with external numSets
  useEffect(() => {
    if (externalNumSets !== undefined && externalNumSets !== numSets) {
      setNumSets(externalNumSets);
    }
  }, [externalNumSets, numSets]);
  
  // Update number of sets
  useEffect(() => {
    const newSets = Array(numSets).fill(null).map((_, i) => sets[i] || { home: 0, away: 0 });
    setSets(newSets);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numSets]);
  
  // Notify parent of changes
  useEffect(() => {
    if (numSets === 1) {
      // Single set mode: use simple scores
      if (aborted) {
        onResultChange?.({
          home_score: homeScore,
          away_score: awayScore,
          sets: [{ home: homeScore, away: awayScore }],
          numSets: 1,
          aborted: true,
          abort_reason: abortReason,
          abort_by: abortBy
        });
      } else {
        onResultChange?.({
          home_score: homeScore,
          away_score: awayScore,
          sets: [{ home: homeScore, away: awayScore }],
          numSets: 1,
          aborted: false
        });
      }
    } else {
      // Multi-set mode: calculate from sets
      if (aborted) {
        const scores = calculateScores(sets);
        onResultChange?.({
          ...scores,
          sets,
          numSets,
          aborted: true,
          abort_reason: abortReason,
          abort_by: abortBy
        });
      } else {
        const scores = calculateScores(sets);
        onResultChange?.({
          ...scores,
          sets,
          numSets,
          aborted: false
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, aborted, abortReason, abortBy, numSets, homeScore, awayScore]);
  
  const updateSet = (index, side, value) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [side]: value };
    setSets(newSets);
  };
  
  const scores = numSets === 1 
    ? { home_score: homeScore, away_score: awayScore }
    : calculateScores(sets);
  const setsToWin = ruleset?.config?.sets_to_win || Math.ceil(numSets / 2);
  
  return (
    <div style={{ width: '100%' }}>
      {/* Anzahl Sätze is now managed in parent (GameDetailPage) */}
      
      {/* Single Set Mode: No counters here - they're in the main score display */}
      
      {/* Multi-Set Mode: Scoreboard Summary + Set Entry */}
      {numSets > 1 && !aborted && (
        <>
          {/* Scoreboard Summary */}
          <div style={{
            marginBottom: 16,
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(14, 42, 34, 0.6), rgba(14, 42, 34, 0.4))',
            border: '2px solid rgba(47, 107, 87, 0.5)',
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: isMobile ? 11 : 12, color: '#9db', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Spieler 1
              </div>
              <div style={{ fontSize: isMobile ? 32 : 40, fontWeight: 900, color: '#f4fff8' }}>
                {scores.home_score}
              </div>
            </div>
            <div style={{ fontSize: isMobile ? 20 : 24, color: '#9db', fontWeight: 700 }}>:</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: isMobile ? 11 : 12, color: '#9db', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Spieler 2
              </div>
              <div style={{ fontSize: isMobile ? 32 : 40, fontWeight: 900, color: '#f4fff8' }}>
                {scores.away_score}
              </div>
            </div>
          </div>
          
          {/* Sets Entry */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              fontSize: isMobile ? 13 : 14, 
              color: '#9db', 
              marginBottom: 12, 
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {!isOpenMatch && `Best of ${numSets} (${setsToWin} Gewinnsätze erforderlich)`}
              {isOpenMatch && 'Sätze eintragen'}
            </div>
            
            {sets.map((set, index) => (
              <div key={index} style={{
                marginBottom: 12,
                padding: '12px 16px',
                background: 'rgba(26, 73, 60, 0.3)',
                border: '1px solid rgba(47, 107, 87, 0.4)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 10 : 16
              }}>
                <div style={{ 
                  minWidth: isMobile ? 50 : 60, 
                  color: '#9db', 
                  fontSize: isMobile ? 12 : 14,
                  fontWeight: 700
                }}>
                  Satz {index + 1}
                </div>
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
                  <Counter
                    value={set.home}
                    onChange={(v) => updateSet(index, 'home', v)}
                    min={0}
                    max={99}
                    disabled={disabled}
                  />
                  <span style={{ fontSize: isMobile ? 16 : 18, color: '#9db', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>:</span>
                  <Counter
                    value={set.away}
                    onChange={(v) => updateSet(index, 'away', v)}
                    min={0}
                    max={99}
                    disabled={disabled}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      
      {/* Aborted Match Section */}
      {aborted && (
        <div style={{
          marginBottom: 16,
          padding: '16px',
          background: 'rgba(95, 45, 45, 0.2)',
          border: '1px solid rgba(95, 45, 45, 0.5)',
          borderRadius: 10
        }}>
          <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: '#ff9999', marginBottom: 12 }}>
            ⚠️ Spielabbruch
          </div>
          
          {/* Show current score */}
          <div style={{ 
            marginBottom: 12,
            padding: '12px',
            background: 'rgba(26, 73, 60, 0.3)',
            borderRadius: 8,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: isMobile ? 11 : 12, color: '#9db', marginBottom: 4 }}>
              Stand beim Abbruch
            </div>
            <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, color: '#f4fff8' }}>
              {numSets === 1 ? `${homeScore} : ${awayScore}` : `${scores.home_score} : ${scores.away_score}`}
            </div>
          </div>
          
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#9db', fontSize: isMobile ? 12 : 13, marginBottom: 6, fontWeight: 600 }}>
              Abgebrochen von:
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setAbortBy('home')}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: abortBy === 'home' ? '2px solid #debc7c' : '1px solid rgba(47, 107, 87, 0.4)',
                  background: abortBy === 'home' ? 'rgba(222, 188, 124, 0.2)' : 'rgba(26, 73, 60, 0.3)',
                  color: abortBy === 'home' ? '#debc7c' : '#9db',
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer'
                }}
              >
                Spieler 1
              </button>
              <button
                type="button"
                onClick={() => setAbortBy('away')}
                disabled={disabled}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: abortBy === 'away' ? '2px solid #debc7c' : '1px solid rgba(47, 107, 87, 0.4)',
                  background: abortBy === 'away' ? 'rgba(222, 188, 124, 0.2)' : 'rgba(26, 73, 60, 0.3)',
                  color: abortBy === 'away' ? '#debc7c' : '#9db',
                  fontWeight: 600,
                  cursor: disabled ? 'not-allowed' : 'pointer'
                }}
              >
                Spieler 2
              </button>
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', color: '#9db', fontSize: isMobile ? 12 : 13, marginBottom: 6, fontWeight: 600 }}>
              Abbruchgrund:
            </label>
            <select
              value={abortReason}
              onChange={(e) => setAbortReason(e.target.value)}
              disabled={disabled}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid rgba(47, 107, 87, 0.4)',
                background: 'rgba(26, 73, 60, 0.5)',
                color: '#e8efe8',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 500
              }}
            >
              <option value="">Grund auswählen...</option>
              <option value="injury">Verletzung</option>
              <option value="weather">Wetter</option>
              <option value="withdrawal">Aufgabe</option>
              <option value="disqualification">Disqualifikation</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>
        </div>
      )}
      
      {/* Abort Toggle Button */}
      {!disabled && (
        <button
          type="button"
          onClick={() => setAborted(!aborted)}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid rgba(95, 45, 45, 0.5)',
            background: aborted ? 'rgba(47, 107, 87, 0.3)' : 'rgba(95, 45, 45, 0.2)',
            color: aborted ? '#9db' : '#ff9999',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {aborted ? '↩️ Zurück zur normalen Eingabe' : '⚠️ Spielabbruch melden'}
        </button>
      )}
    </div>
  );
}
