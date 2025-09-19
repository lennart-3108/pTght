import Link from "next/link";

// Inside your page component, before return:
const toId = (v: any) =>
  typeof v === "number" ? String(v) : typeof v === "string" && /^\d+$/.test(v) ? v : null;

const homeId = game?.home_id ?? game?.homeId ?? toId(game?.home);
const awayId = game?.away_id ?? game?.awayId ?? toId(game?.away);
const homeLabel = (game?.home_name ?? game?.home ?? "—") as string;
const awayLabel = (game?.away_name ?? game?.away ?? "—") as string;

// In the JSX where you render the match header/details:
<>
  {/* Partie with profile links */}
  <p>
    Partie:{" "}
    {homeId ? (
      <Link href={`/user/${homeId}`} legacyBehavior>
        <a>{homeLabel}</a>
      </Link>
    ) : (
      homeLabel
    )}
    {" – "}
    {awayId ? (
      <Link href={`/user/${awayId}`} legacyBehavior>
        <a>{awayLabel}</a>
      </Link>
    ) : (
      awayLabel
    )}
  </p>

  {/* Datum */}
  <p>
    Datum:{" "}
    {game?.kickoff_at
      ? new Date(game.kickoff_at).toLocaleString("de-DE")
      : game?.scheduledAt
      ? new Date(game.scheduledAt).toLocaleString("de-DE")
      : "—"}
  </p>

  {/* Ergebnis */}
  <p>
    Ergebnis:{" "}
    {typeof game?.home_score === "number" && typeof game?.away_score === "number"
      ? `${game.home_score} : ${game.away_score}`
      : game?.result && String(game.result).trim().length > 0
      ? game.result
      : "—"}
  </p>
</>
