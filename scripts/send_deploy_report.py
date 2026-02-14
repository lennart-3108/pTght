from pathlib import Path
import smtplib
import ssl
from email.message import EmailMessage


def load_env(path: Path) -> dict:
    env = {}
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def main() -> int:
    env_path = Path(__file__).resolve().parents[1] / "backend" / ".env"
    env = load_env(env_path)

    host = env.get("MAIL_HOST")
    port = int(env.get("MAIL_PORT", "465"))
    user = env.get("MAIL_USER")
    password = env.get("MAIL_PASS")
    secure = env.get("MAIL_SECURE", "true").lower() != "false"
    mail_from = env.get("MAIL_FROM") or user

    if not (host and user and password):
        print("MAIL_CONFIG_MISSING")
        return 2

    lines = [
        "Deployment Report MatchLeague",
        "",
        "Status: PARTIALLY COMPLETED",
        "",
        "Completed:",
        "- Emojis removed from StartPage buttons (Match suchen, Liga suchen)",
        "- Project taskboard hidden on non-dev instances (test/prod) in routes and header",
        "- Local checks passed: frontend tests, frontend build, backend check:all, backend check:homepage-quality",
        "",
        "Blocked:",
        "- Remote deployment to test/prod failed from this environment: FTP/FTPS on port 21 refused",
        "- SSH port 22 reachable, but available keys are not accepted and password auth is disabled",
        "",
        "Reachability checks:",
        "- https://test.matchleague.org => HTTP 200",
        "- https://test.matchleague.org/api/health => HTTP 200",
        "- https://matchleague.org and https://www.matchleague.org => HTTP 000 from this environment",
    ]

    msg = EmailMessage()
    msg["Subject"] = "MatchLeague Deployment Report (partial - deploy blocked)"
    msg["From"] = mail_from
    msg["To"] = "lennart.3108@icloud.com"
    msg.set_content("\n".join(lines))

    if secure or port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=20) as server:
            server.login(user, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            server.starttls(context=ssl.create_default_context())
            server.login(user, password)
            server.send_message(msg)

    print("MAIL_SENT")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
