const { renderEmailTemplate } = require('./emailTemplate');

/**
 * Zentrale Sammlung aller E-Mail-Templates für MatchLeague
 * Jedes Template kann über emailTemplates.templateName(params) aufgerufen werden
 */

const emailTemplates = {
  /**
   * 1. Registrierung - E-Mail-Bestätigung
   */
  emailConfirmation: ({ firstname, confirmUrl }) => ({
    subject: 'E-Mail bestätigen',
    html: renderEmailTemplate({
      title: 'E-Mail bestätigen',
      body: `<p>Hallo ${firstname},</p><p>bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p>`,
      ctaLabel: 'E-Mail bestätigen',
      ctaUrl: confirmUrl,
      previewText: 'Bitte E-Mail bestätigen',
    })
  }),

  /**
   * 2. Passwort geändert
   */
  passwordChanged: ({ firstname }) => ({
    subject: 'Passwort geändert',
    html: renderEmailTemplate({
      title: 'Passwort geändert',
      body: `<p>Hallo ${firstname || ''},</p><p>dies ist eine automatische Bestätigung, dass dein Passwort erfolgreich geändert wurde.</p><p>Falls du diese Änderung nicht durchgeführt hast, kontaktiere bitte umgehend unseren Support.</p>`,
      previewText: 'Passwort wurde geändert',
    })
  }),

  /**
   * 3. Match erstellt (für Creator)
   */
  matchCreated: ({ firstname, matchId, sport, city, kickoffAt }) => ({
    subject: 'Match erfolgreich erstellt',
    html: renderEmailTemplate({
      title: 'Match erstellt',
      body: `<p>Hallo ${firstname},</p><p>dein Match wurde erfolgreich erstellt!</p><ul><li><strong>Sport:</strong> ${sport}</li><li><strong>Ort:</strong> ${city}</li>${kickoffAt ? `<li><strong>Termin:</strong> ${kickoffAt}</li>` : ''}</ul><p>Sobald sich ein Gegner anmeldet, informieren wir dich per E-Mail.</p>`,
      ctaLabel: 'Match ansehen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/matches/${matchId}`,
      previewText: 'Dein Match wurde erstellt',
    })
  }),

  /**
   * 4. Gegner gefunden (für beide Spieler)
   */
  opponentFound: ({ firstname, matchId, opponentName, sport, city }) => ({
    subject: 'Gegner gefunden!',
    html: renderEmailTemplate({
      title: 'Gegner gefunden!',
      body: `<p>Hallo ${firstname},</p><p>Großartige Neuigkeiten! <strong>${opponentName}</strong> hat sich für dein Match angemeldet.</p><ul><li><strong>Sport:</strong> ${sport}</li><li><strong>Ort:</strong> ${city}</li></ul><p>Jetzt könnt ihr gemeinsam einen Termin vereinbaren.</p>`,
      ctaLabel: 'Termin vereinbaren',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/matches/${matchId}`,
      previewText: 'Ein Gegner wurde gefunden',
    })
  }),

  /**
   * 5. Erfolgreich für Match angemeldet (für Joiner)
   */
  matchJoined: ({ firstname, matchId, creatorName, sport, city }) => ({
    subject: 'Erfolgreich für Match angemeldet',
    html: renderEmailTemplate({
      title: 'Anmeldung erfolgreich',
      body: `<p>Hallo ${firstname},</p><p>du hast dich erfolgreich für ein Match gegen <strong>${creatorName}</strong> angemeldet!</p><ul><li><strong>Sport:</strong> ${sport}</li><li><strong>Ort:</strong> ${city}</li></ul><p>Ihr könnt jetzt gemeinsam einen Termin vereinbaren.</p>`,
      ctaLabel: 'Match ansehen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/matches/${matchId}`,
      previewText: 'Du bist jetzt für ein Match angemeldet',
    })
  }),

  /**
   * 6. Match geplant / Termin bestätigt
   */
  matchScheduled: ({ firstname, matchId, kickoffAt, location, opponentName }) => ({
    subject: 'Match-Termin bestätigt',
    html: renderEmailTemplate({
      title: 'Termin bestätigt',
      body: `<p>Hallo ${firstname},</p><p>dein Match gegen <strong>${opponentName}</strong> wurde geplant:</p><ul><li><strong>Datum & Uhrzeit:</strong> ${kickoffAt}</li>${location ? `<li><strong>Ort:</strong> ${location}</li>` : ''}</ul><p>Wir wünschen dir viel Erfolg!</p>`,
      ctaLabel: 'Match ansehen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/matches/${matchId}`,
      previewText: 'Dein Match-Termin steht fest',
    })
  }),

  /**
   * 7. Ergebnis-Erinnerung (1 Tag nach Match)
   */
  resultReminder1Day: ({ firstname, matchId, opponentName, kickoffAt }) => ({
    subject: 'Ergebnis eintragen',
    html: renderEmailTemplate({
      title: 'Ergebnis eintragen',
      body: `<p>Hallo ${firstname},</p><p>dein Match gegen <strong>${opponentName}</strong> am <strong>${kickoffAt}</strong> ist vorbei.</p><p>Bitte trage das Ergebnis ein, damit deine Statistik aktualisiert wird!</p>`,
      ctaLabel: 'Ergebnis eintragen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/matches/${matchId}`,
      previewText: 'Bitte Match-Ergebnis eintragen',
      notice: '📝 Ergebnis noch ausstehend',
    })
  }),

  /**
   * 8. Ergebnis-Erinnerungen (2-10 Tage)
   */
  resultReminderMultipleDays: ({ firstname, matchId, opponentName, daysAgo }) => ({
    subject: `Erinnerung: Ergebnis eintragen (${daysAgo} Tage)`,
    html: renderEmailTemplate({
      title: 'Ergebnis-Erinnerung',
      body: `<p>Hallo ${firstname},</p><p>dein Match gegen <strong>${opponentName}</strong> ist bereits <strong>${daysAgo} Tage</strong> her.</p><p>Bitte trage das Ergebnis ein, um deine Statistik zu vervollständigen.</p>`,
      ctaLabel: 'Ergebnis eintragen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/matches/${matchId}`,
      previewText: `Ergebnis-Erinnerung (${daysAgo} Tage)`,
      notice: `⏰ ${daysAgo} Tage seit dem Match`,
    })
  }),

  /**
   * 9. Ergebnis eingetragen
   */
  resultSubmitted: ({ firstname, matchId, score, opponentName }) => ({
    subject: 'Ergebnis eingetragen',
    html: renderEmailTemplate({
      title: 'Ergebnis bestätigt',
      body: `<p>Hallo ${firstname},</p><p>das Ergebnis für dein Match gegen <strong>${opponentName}</strong> wurde eingetragen:</p><p style="text-align: center; font-size: 32px; font-weight: 800; color: #f5c542; margin: 20px 0;">${score}</p><p>Deine Statistik wurde aktualisiert. Weiter so!</p>`,
      ctaLabel: 'Statistik ansehen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/profile`,
      previewText: `Match-Ergebnis: ${score}`,
    })
  }),

  /**
   * 10. Match abgesagt
   */
  matchCancelled: ({ firstname, matchId, sport, cancelledBy }) => ({
    subject: 'Match abgesagt',
    html: renderEmailTemplate({
      title: 'Match abgesagt',
      body: `<p>Hallo ${firstname},</p><p>dein ${sport}-Match wurde ${cancelledBy ? `von <strong>${cancelledBy}</strong>` : ''} abgesagt.</p><p>Du kannst jederzeit ein neues Match erstellen oder dich für ein anderes Match anmelden.</p>`,
      ctaLabel: 'Neue Matches suchen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/leagues`,
      previewText: 'Match wurde abgesagt',
    })
  }),

  /**
   * 11. Buchungsbestätigung
   */
  bookingConfirmed: ({ firstname, bookingId, assetName, slotDate, slotTime, location }) => ({
    subject: 'Buchung bestätigt',
    html: renderEmailTemplate({
      title: 'Buchung bestätigt',
      body: `<p>Hallo ${firstname},</p><p>deine Buchung wurde bestätigt:</p><ul><li><strong>Anlage:</strong> ${assetName}</li><li><strong>Datum:</strong> ${slotDate}</li><li><strong>Uhrzeit:</strong> ${slotTime}</li><li><strong>Ort:</strong> ${location}</li></ul><p>Wir freuen uns auf dich!</p>`,
      ctaLabel: 'Buchung ansehen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/bookings/${bookingId}`,
      previewText: 'Deine Buchung wurde bestätigt',
    })
  }),

  /**
   * 12. Buchungserinnerung (24h vorher)
   */
  bookingReminder: ({ firstname, assetName, slotDate, slotTime, location }) => ({
    subject: 'Erinnerung: Buchung morgen',
    html: renderEmailTemplate({
      title: 'Buchung morgen',
      body: `<p>Hallo ${firstname},</p><p>eine Erinnerung an deine Buchung morgen:</p><ul><li><strong>Anlage:</strong> ${assetName}</li><li><strong>Datum:</strong> ${slotDate}</li><li><strong>Uhrzeit:</strong> ${slotTime}</li><li><strong>Ort:</strong> ${location}</li></ul><p>Wir sehen uns!</p>`,
      previewText: 'Erinnerung an deine Buchung morgen',
      notice: '📅 Morgen um ' + slotTime,
    })
  }),

  /**
   * 13. Welcome Mail (nach erfolgreicher Registrierung)
   */
  welcome: ({ firstname }) => ({
    subject: 'Willkommen bei MatchLeague!',
    html: renderEmailTemplate({
      title: 'Willkommen!',
      body: `<p>Hallo ${firstname},</p><p>herzlich willkommen bei <strong>MatchLeague</strong>! 🎉</p><p>Wir freuen uns, dass du Teil unserer Community bist.</p><p><strong>So geht's weiter:</strong></p><ol><li>Vervollständige dein Profil</li><li>Tritt einer Liga bei oder erstelle ein offenes Match</li><li>Finde Gegner und spiele!</li></ol><p>Viel Erfolg und Spaß beim Spielen!</p>`,
      ctaLabel: 'Profil vervollständigen',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/profile`,
      previewText: 'Willkommen bei MatchLeague',
    })
  }),

  /**
   * 14. Liga-Einladung
   */
  leagueInvite: ({ firstname, leagueName, invitedBy, leagueId }) => ({
    subject: `Einladung zur Liga: ${leagueName}`,
    html: renderEmailTemplate({
      title: 'Liga-Einladung',
      body: `<p>Hallo ${firstname},</p><p><strong>${invitedBy}</strong> hat dich zur Liga <strong>${leagueName}</strong> eingeladen!</p><p>Tritt der Liga bei und spiele gegen andere Mitglieder.</p>`,
      ctaLabel: 'Liga beitreten',
      ctaUrl: `${process.env.FRONTEND_PUBLIC_URL || 'http://localhost:3000'}/league/${leagueId}`,
      previewText: `Einladung zur Liga ${leagueName}`,
    })
  }),

  /**
   * 15. Testmail
   */
  test: () => ({
    subject: 'MatchLeague – Testmail',
    html: renderEmailTemplate({
      title: 'Testmail',
      body: '<p>Dies ist eine <b>Testmail</b> von MatchLeague.</p><p>Alle E-Mail-Templates funktionieren korrekt! ✅</p>',
      previewText: 'Testmail von MatchLeague',
    })
  }),
};

module.exports = { emailTemplates };
