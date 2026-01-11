#!/usr/bin/env node

/**
 * Test-Script: Sendet alle E-Mail-Templates an eine Test-Adresse
 * Usage: node backend/scripts/test-email-templates.js <email>
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createMailer } = require('../src/mailer');
const { emailTemplates } = require('../src/emailTemplates');

const TEST_EMAIL = process.argv[2] || 'lennart.3108@icloud.com';

console.log(`\n📧 Teste alle E-Mail-Templates...`);
console.log(`📬 Empfänger: ${TEST_EMAIL}\n`);

const mailerConfig = {
  host: process.env.MAIL_HOST || 'smtp.hostinger.com',
  port: Number(process.env.MAIL_PORT || 465),
  secure: process.env.MAIL_SECURE !== 'false',
  user: process.env.MAIL_USER,
  pass: process.env.MAIL_PASS,
  debug: process.env.MAIL_DEBUG === '1',
  forceTo: null, // Kein Force-To beim Testen
  forwardTo: process.env.FORWARD_TO,
  imap: null, // Kein IMAP beim schnellen Testen
};

const { sendMail } = createMailer(mailerConfig);

const testCases = [
  {
    name: '1. E-Mail-Bestätigung (Registrierung)',
    template: () => emailTemplates.emailConfirmation({
      firstname: 'Max',
      confirmUrl: 'http://localhost:5001/api/confirm/test-token-123'
    })
  },
  {
    name: '2. Passwort geändert',
    template: () => emailTemplates.passwordChanged({
      firstname: 'Max'
    })
  },
  {
    name: '3. Match erstellt',
    template: () => emailTemplates.matchCreated({
      firstname: 'Max',
      matchId: 42,
      sport: 'Tennis Einzel',
      city: 'Bremen',
      kickoffAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('de-DE')
    })
  },
  {
    name: '4. Gegner gefunden',
    template: () => emailTemplates.opponentFound({
      firstname: 'Max',
      matchId: 42,
      opponentName: 'Anna',
      sport: 'Tennis Einzel',
      city: 'Bremen'
    })
  },
  {
    name: '5. Erfolgreich für Match angemeldet',
    template: () => emailTemplates.matchJoined({
      firstname: 'Anna',
      matchId: 42,
      creatorName: 'Max',
      sport: 'Tennis Einzel',
      city: 'Bremen'
    })
  },
  {
    name: '6. Match-Termin bestätigt',
    template: () => emailTemplates.matchScheduled({
      firstname: 'Max',
      matchId: 42,
      kickoffAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString('de-DE'),
      location: 'Tennisplatz Bremen-Nord, Platz 3',
      opponentName: 'Anna'
    })
  },
  {
    name: '7. Ergebnis-Erinnerung (1 Tag)',
    template: () => emailTemplates.resultReminder1Day({
      firstname: 'Max',
      matchId: 42,
      opponentName: 'Anna',
      kickoffAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toLocaleString('de-DE')
    })
  },
  {
    name: '8. Ergebnis-Erinnerung (2 Tage)',
    template: () => emailTemplates.resultReminderMultipleDays({
      firstname: 'Max',
      matchId: 42,
      opponentName: 'Anna',
      daysAgo: 2
    })
  },
  {
    name: '9. Ergebnis-Erinnerung (7 Tage)',
    template: () => emailTemplates.resultReminderMultipleDays({
      firstname: 'Max',
      matchId: 42,
      opponentName: 'Anna',
      daysAgo: 7
    })
  },
  {
    name: '10. Ergebnis eingetragen',
    template: () => emailTemplates.resultSubmitted({
      firstname: 'Max',
      matchId: 42,
      score: '6:4, 6:3',
      opponentName: 'Anna'
    })
  },
  {
    name: '11. Match abgesagt',
    template: () => emailTemplates.matchCancelled({
      firstname: 'Max',
      matchId: 42,
      sport: 'Tennis',
      cancelledBy: 'Anna'
    })
  },
  {
    name: '12. Buchung bestätigt',
    template: () => emailTemplates.bookingConfirmed({
      firstname: 'Max',
      bookingId: 123,
      assetName: 'Tennisplatz 3',
      slotDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE'),
      slotTime: '18:00 - 19:00',
      location: 'Tennisanlage Bremen-Nord'
    })
  },
  {
    name: '13. Buchungserinnerung (24h)',
    template: () => emailTemplates.bookingReminder({
      firstname: 'Max',
      assetName: 'Tennisplatz 3',
      slotDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE'),
      slotTime: '18:00',
      location: 'Tennisanlage Bremen-Nord'
    })
  },
  {
    name: '14. Willkommens-Mail',
    template: () => emailTemplates.welcome({
      firstname: 'Max'
    })
  },
  {
    name: '15. Liga-Einladung',
    template: () => emailTemplates.leagueInvite({
      firstname: 'Max',
      leagueName: 'Bremen Tennis Liga',
      invitedBy: 'Anna',
      leagueId: 5
    })
  },
  {
    name: '16. Testmail',
    template: () => emailTemplates.test()
  },
];

async function sendAllTemplates() {
  console.log(`Sende ${testCases.length} E-Mails...\n`);
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    try {
      const { subject, html } = testCase.template();
      console.log(`[${i + 1}/${testCases.length}] ${testCase.name}...`);
      
      await sendMail(TEST_EMAIL, subject, html);
      console.log(`   ✅ Gesendet: "${subject}"\n`);
      
      // Kurze Pause zwischen Mails, um Server nicht zu überlasten
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`   ❌ Fehler: ${error.message}\n`);
    }
  }
  
  console.log(`\n🎉 Fertig! Alle Templates wurden an ${TEST_EMAIL} gesendet.`);
  console.log(`📬 Bitte prüfe dein Postfach (auch Spam-Ordner).\n`);
}

sendAllTemplates().catch(error => {
  console.error('FATAL ERROR:', error);
  process.exit(1);
});
