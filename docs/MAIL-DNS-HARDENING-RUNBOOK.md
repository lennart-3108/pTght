# Mail DNS Hardening Runbook (matchleague.org)

## Ziel
Sichere, zustellbare Mail-Authentifizierung für `matchleague.org` (MX/SPF/DKIM/DMARC) mit klaren Verifikationsschritten.

## Vorbedingungen
- Authoritative DNS bei United Domains (`ns.udag.*`)
- Mailprovider im Einsatz (Hostinger)
- Zugriff auf DNS-Panel + Hostinger Email DNS-Vorgaben

## Soll-Zustand
- MX zeigt vollständig auf Hostinger-Mailserver
- SPF enthält genau den vom Mailprovider vorgegebenen Include-Mechanismus
- DKIM Selector Records sind vollständig und `valid`
- DMARC ist gesetzt (mindestens Monitoring), mit Reporting-Adressen

## Umsetzungsschritte
1. **MX setzen**
   - Alle alten, nicht benötigten MX-Einträge entfernen.
   - Nur die aktuellen Hostinger-MX-Werte laut Provider-Doku eintragen.

2. **SPF korrigieren**
   - Vorhandene SPF-TXT prüfen.
   - Auf den aktuell vom Provider geforderten SPF-Ausdruck umstellen.
   - Genau **ein** SPF-Record für die Root-Domain behalten.

3. **DKIM aktivieren**
   - DKIM in Hostinger aktivieren.
   - Alle bereitgestellten Selector-TXT/CNAME-Einträge in UD übernehmen.

4. **DMARC hinzufügen**
   - `_dmarc.matchleague.org` als TXT anlegen.
   - Startwert:
     - `p=none` (nur Monitoring),
     - `rua`/`ruf` Reports setzen,
     - `adkim=s`, `aspf=s` erwägen.
   - Nach stabiler Zustellung schrittweise auf `quarantine`/`reject` erhöhen.

5. **Subdomains prüfen**
   - Für `dev.matchleague.org` / `test.matchleague.org` getrennt validieren,
     falls Mailversand dort aktiv ist.

## Verifikation (CLI)
```bash
# Authoritative check (UD)
dig +short NS matchleague.org

# MX
dig +short MX matchleague.org @ns.udag.de

# SPF (Root)
dig +short TXT matchleague.org @ns.udag.de

# DMARC
dig +short TXT _dmarc.matchleague.org @ns.udag.de

# DKIM selectors (Beispiel, Selector anpassen)
dig +short TXT selector1._domainkey.matchleague.org @ns.udag.de
```

## Akzeptanzkriterien
- MX vollständig auf Hostinger
- SPF ohne Altlasten früherer Provider
- DKIM laut Provider als `valid` markiert
- DMARC vorhanden und syntaktisch korrekt
- Testmails bestehen SPF, DKIM und DMARC alignment

## Rollout-Hinweise
- TTL während Migration kurz halten (z. B. 300s), danach erhöhen.
- Änderungen dokumentieren (Zeitpunkt, alter/neuer Wert, Verantwortlicher).
- Nach 24h erneut prüfen (Propagation + Zustellberichte).
