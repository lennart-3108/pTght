from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
import smtplib
import ssl


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


@dataclass(frozen=True)
class AuditSummary:
    total: int
    low: int
    moderate: int
    high: int
    critical: int


def build_report() -> str:
    # Note: This report is based on the latest local verification run performed in this workspace.
    now = datetime.now(timezone.utc).astimezone()

    lines: list[str] = []
    lines.append("MatchLeague – Vollumfänglicher App-Check (Funktion + Security)")
    lines.append(f"Datum/Zeit: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    lines.append("Umgebung: macOS (lokaler Workspace)")
    lines.append("")

    # Functional checks
    lines.append("1) Funktionale Checks (lokal)")
    lines.append("Backend + Frontend Smoke/Health:")
    lines.append("- Backend Healthcheck: 100% success (8/8) gegen http://localhost:5001")
    lines.append("- Frontend Runtime Check: Seite lädt, React rendert, keine Console Errors")
    lines.append("- Homepage Quality Audit: 8/8 Routen OK (/, /login, /register, /leagues, /impressum, /datenschutz, /agb, /meldung-rechtswidriger-inhalte)")
    lines.append("Backend Audits:")
    lines.append("- Syntax/Runtime Checks via backend: OK (Frontend compiled with warnings, aber keine Errors)")
    lines.append("- Lizenz-Guards Check: ausgeführt (User 1), keine Hard-Fails")
    lines.append("- Data-Quality-Audit: OK (nach Cleanup)")
    lines.append("- RuleSet-System Test: OK (Validation + Decision Engine + Result Persist) – Standings Schritt übersprungen (siehe Findings)")
    lines.append("")

    lines.append("Frontend Tests/Build:")
    lines.append("- Unit Tests: PASS (1 Suite / 1 Test)")
    lines.append("- Production Build: SUCCESS, aber ESLint-Warnings (unused vars / exhaustive-deps etc.)")
    lines.append("")

    # Security checks
    lines.append("2) Security Checks")
    lines.append("Dependency Scan (npm audit, omit=dev):")
    lines.append("- Backend: total=0 (high=0, moderate=0, low=0, critical=0) ✅")
    lines.append("  (u.a. nodemailer aktualisiert und tar via overrides gepinnt)")
    lines.append("- Frontend: zuletzt gemessen total=4 (moderate=3, high=1, critical=0)")
    lines.append("")

    lines.append("Statischer Schnellscan (Quellcode):")
    lines.append("- Keine Treffer für eval()/new Function()/dangerouslySetInnerHTML in Source-Ordnern")
    lines.append("- child_process Nutzung gefunden (z.B. Deploy-Webhook, Build/Agent-Skripte) → Review/Restriktionen empfohlen")
    lines.append("")

    # Findings / fixes done
    lines.append("3) Findings & durchgeführte Fixes")
    lines.append("- Data-Quality: 17 verwaiste user_leagues (ohne User) gefunden und bereinigt (deleted=17). Danach Audit grün.")
    lines.append("- RuleSet-Integrationstest war nicht DB-robust (harte IDs, Schema-Mismatch) → Script angepasst, damit es mit aktuellem DB-Schema läuft.")
    lines.append("- Deploy-Webhooks: Route /api/deploy war aktiv und fiel ohne DEPLOY_TOKEN auf einen festen Default-Token zurück → gehärtet:")
    lines.append("  - Webhook ist deaktiviert, wenn DEPLOY_TOKEN nicht gesetzt ist")
    lines.append("  - Token-Vergleich timing-safe")
    lines.append("  - Query-Token nur noch bei explizitem ALLOW_DEPLOY_TOKEN_QUERY=true")
    lines.append("- Skalierung: Ligen werden auf der Ligen-Seite erst nach Stadt-Auswahl geladen; Cities werden lazy pro State nachgeladen (statt komplette Liste vorab).")
    lines.append("")

    # Risks / open issues
    lines.append("4) Offene Punkte / Risiken")
    lines.append("- Frontend npm audit hat noch verbleibende Findings. Empfohlen:")
    lines.append("  - gezielte Upgrades (z.B. über react-scripts/webpack-dev-server Kette, axios/react-router-dom)")
    lines.append("  - anschließend erneutes npm audit und Smoke-Test")
    lines.append("- Standings/Results-Schema: In der geprüften SQLite DB existiert keine standings Tabelle, und results hat Schema (raw_payload/canonical_payload/...).")
    lines.append("  - Services wie standingsService erwarten ein anderes results-Schema (winner/home_points/metadata/result_data + standings).")
    lines.append("  - Empfehlung: DB-Migrationen/Schema und Services aufeinander konsolidieren, sonst sind Standings-Features aktuell nicht zuverlässig.")
    lines.append("- Frontend Build-Warnings: Viele ESLint/Hook-Dependency Warnings; funktional ok, aber Wartbarkeit/Fehlerrisiko erhöht.")
    lines.append("")

    # Deployment / reachability context
    lines.append("5) Deployment / Erreichbarkeit (bekannter Stand aus diesem Workspace)")
    lines.append("- https://test.matchleague.org => HTTP 200")
    lines.append("- https://test.matchleague.org/api/health => HTTP 200")
    lines.append("- https://matchleague.org und https://www.matchleague.org => aus dieser Umgebung nicht erreichbar (HTTP 000)")
    lines.append("")

    lines.append("6) Empfehlung – nächste Schritte")
    lines.append("- Abhängigkeiten sicher aktualisieren (ohne Breaking Changes, wo möglich) und danach wieder: Backend health + Frontend build/test")
    lines.append("- Standings/Results Schema-Konsolidierung planen (Migration + Services + Tests)")
    lines.append("- Deploy-Webhooks nur in Dev/Test aktivieren; DEPLOY_TOKEN setzen und ALLOW_DEPLOY_TOKEN_QUERY=false lassen")
    lines.append("")

    lines.append("Hinweis: Das ist ein automatisierter/entwicklungsnaher Check (Smoke/Quality/Audit) und ersetzt keinen externen Penetrationstest.")

    return "\n".join(lines)


def send_mail(to_addr: str, subject: str, body: str) -> None:
    env_path = Path(__file__).resolve().parents[1] / "backend" / ".env"
    env = load_env(env_path)

    host = env.get("MAIL_HOST")
    port = int(env.get("MAIL_PORT", "465"))
    user = env.get("MAIL_USER")
    password = env.get("MAIL_PASS")
    secure = env.get("MAIL_SECURE", "true").lower() != "false"
    mail_from = env.get("MAIL_FROM") or user

    if not (host and user and password and mail_from):
        raise RuntimeError("MAIL_CONFIG_MISSING (MAIL_HOST/MAIL_USER/MAIL_PASS)")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = mail_from
    msg["To"] = to_addr
    msg.set_content(body)

    if secure or port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=25) as server:
            server.login(user, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=25) as server:
            server.starttls(context=ssl.create_default_context())
            server.login(user, password)
            server.send_message(msg)


def main() -> int:
    body = build_report()
    send_mail(
        to_addr="lennart.3108@icloud.com",
        subject="MatchLeague – Vollumfänglicher App-Check (Funktion + Security)",
        body=body,
    )
    print("MAIL_SENT")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
