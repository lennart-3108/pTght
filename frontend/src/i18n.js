import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'ml:lang';

const translations = {
  de: {
    'lang.switch': 'EN',
    'nav.login': 'Login',
    'nav.leagues': 'Ligen',
    'nav.subscriptions': 'Abos',
    'nav.tasks': 'Tasks',
    'nav.register': 'Registrieren',
    'nav.profile': 'Profil',
    'nav.teams': 'Teams',
    'nav.booking': 'Platz buchen',
    'nav.training': 'Training',
    'nav.clubs': 'Vereine',
    'nav.chats': 'Chats',
    'nav.news': 'Neuigkeiten',
    'nav.compliance': 'Compliance',
    'nav.logout': 'Abmelden',

    'footer.impressum': 'Impressum',
    'footer.privacy': 'Datenschutz',
    'footer.terms': 'Nutzungsbedingungen',
    'footer.report': 'Meldung rechtswidriger Inhalte',

    'report.title': 'Meldung rechtswidriger Inhalte',
    'report.subtitle': 'Meldeverfahren gemäß Digital Services Act (DSA)',
    'report.intro': 'MatchLeague stellt ein Meldeverfahren gemäß DSA bereit.',
    'report.reportable': 'Meldbar sind insbesondere:',
    'report.item1': 'rechtswidrige Inhalte',
    'report.item2': 'beleidigende oder diskriminierende Inhalte',
    'report.item3': 'unzulässige Profilbilder',
    'report.item4': 'Missbrauch der Plattform',
    'report.info': 'Meldungen werden direkt im Compliance-System erfasst und bearbeitet.',
    'report.requiredUserId': 'Pflicht: Bitte die sichtbare User-ID des gemeldeten Profils angeben.',
    'report.name': 'Dein Name (optional)',
    'report.email': 'Deine E-Mail (optional)',
    'report.reportedUserId': 'Gemeldete User-ID (aus Profil)',
    'report.subject': 'Betreff',
    'report.url': 'Link zum gemeldeten Inhalt (optional)',
    'report.message': 'Beschreibe den Vorfall so konkret wie möglich',
    'report.send': 'Meldung senden',
    'report.sending': 'Sende Meldung …',
    'report.success': 'Danke, deine Meldung wurde erfasst (ID #{id}).',
    'report.errSend': 'Meldung konnte nicht gesendet werden.',
    'report.cat.illegal': 'Rechtswidriger Inhalt',
    'report.cat.insultDefamation': 'Beleidigung / Rufmord',
    'report.cat.hate': 'Hassrede / Diskriminierung',
    'report.cat.harassment': 'Beleidigung / Diskriminierung',
    'report.cat.profile': 'Unzulässiges Profilbild',
    'report.cat.abuse': 'Plattform-Missbrauch',
    'report.cat.other': 'Sonstiges',

    'compliance.title': 'Compliance Dashboard',
    'compliance.subtitle': 'Offene Meldungen und Taskboard',
    'compliance.noAccess': 'Kein Zugriff. Diese Seite ist nur für Admins verfügbar.',
    'compliance.refresh': 'Aktualisieren',
    'compliance.open': 'Offen',
    'compliance.inReview': 'In Prüfung',
    'compliance.resolved': 'Erledigt',
    'compliance.rejected': 'Abgelehnt',
    'compliance.total': 'Gesamt',
    'compliance.openReports': 'Offene Meldungen',
    'compliance.loadingReports': 'Lade Meldungen …',
    'compliance.noReports': 'Keine offenen Meldungen.',
    'compliance.category': 'Kategorie',
    'compliance.reporter': 'Reporter',
    'compliance.unknown': 'unbekannt',
    'compliance.reportedUserId': 'Gemeldete User-ID',
    'compliance.url': 'URL',
    'compliance.setInReview': 'In Prüfung',
    'compliance.markResolved': 'Erledigt',
    'compliance.createTask': 'Task anlegen',
    'compliance.taskLinked': 'Task #{id} verknüpft',
    'compliance.taskboardOpen': 'Taskboard (offen)',
    'compliance.noOpenTasks': 'Keine offenen Tasks.',
    'compliance.assignee': 'Assignee',
    'compliance.errorLoad': 'Compliance-Daten konnten nicht geladen werden.',
    'compliance.errorUpdate': 'Meldung konnte nicht aktualisiert werden.',
    'compliance.errorTaskCreate': 'Task konnte nicht erstellt werden.',
    'compliance.errorTaskLink': 'Meldung konnte nicht mit Task verknüpft werden.',
  },
  en: {
    'lang.switch': 'DE',
    'nav.login': 'Login',
    'nav.leagues': 'Leagues',
    'nav.subscriptions': 'Subscriptions',
    'nav.tasks': 'Tasks',
    'nav.register': 'Register',
    'nav.profile': 'Profile',
    'nav.teams': 'Teams',
    'nav.booking': 'Book court',
    'nav.training': 'Training',
    'nav.clubs': 'Clubs',
    'nav.chats': 'Chats',
    'nav.news': 'News',
    'nav.compliance': 'Compliance',
    'nav.logout': 'Logout',

    'footer.impressum': 'Imprint',
    'footer.privacy': 'Privacy',
    'footer.terms': 'Terms',
    'footer.report': 'Report illegal content',

    'report.title': 'Report illegal content',
    'report.subtitle': 'Reporting procedure under the Digital Services Act (DSA)',
    'report.intro': 'MatchLeague provides a reporting process under the DSA.',
    'report.reportable': 'You can report in particular:',
    'report.item1': 'illegal content',
    'report.item2': 'insulting or discriminatory content',
    'report.item3': 'inappropriate profile images',
    'report.item4': 'platform abuse',
    'report.info': 'Reports are captured and processed directly in the compliance system.',
    'report.requiredUserId': 'Required: Please provide the visible user ID from the reported profile.',
    'report.name': 'Your name (optional)',
    'report.email': 'Your email (optional)',
    'report.reportedUserId': 'Reported user ID (from profile)',
    'report.subject': 'Subject',
    'report.url': 'Link to reported content (optional)',
    'report.message': 'Describe the incident as precisely as possible',
    'report.send': 'Send report',
    'report.sending': 'Sending report …',
    'report.success': 'Thanks, your report was recorded (ID #{id}).',
    'report.errSend': 'Report could not be sent.',
    'report.cat.illegal': 'Illegal content',
    'report.cat.insultDefamation': 'Insult / defamation',
    'report.cat.hate': 'Hate speech / discrimination',
    'report.cat.harassment': 'Harassment / discrimination',
    'report.cat.profile': 'Inappropriate profile image',
    'report.cat.abuse': 'Platform abuse',
    'report.cat.other': 'Other',

    'compliance.title': 'Compliance Dashboard',
    'compliance.subtitle': 'Open reports and task board',
    'compliance.noAccess': 'No access. This page is available for admins only.',
    'compliance.refresh': 'Refresh',
    'compliance.open': 'Open',
    'compliance.inReview': 'In review',
    'compliance.resolved': 'Resolved',
    'compliance.rejected': 'Rejected',
    'compliance.total': 'Total',
    'compliance.openReports': 'Open reports',
    'compliance.loadingReports': 'Loading reports …',
    'compliance.noReports': 'No open reports.',
    'compliance.category': 'Category',
    'compliance.reporter': 'Reporter',
    'compliance.unknown': 'unknown',
    'compliance.reportedUserId': 'Reported user ID',
    'compliance.url': 'URL',
    'compliance.setInReview': 'Set in review',
    'compliance.markResolved': 'Mark resolved',
    'compliance.createTask': 'Create task',
    'compliance.taskLinked': 'Task #{id} linked',
    'compliance.taskboardOpen': 'Task board (open)',
    'compliance.noOpenTasks': 'No open tasks.',
    'compliance.assignee': 'Assignee',
    'compliance.errorLoad': 'Could not load compliance data.',
    'compliance.errorUpdate': 'Could not update report.',
    'compliance.errorTaskCreate': 'Could not create task.',
    'compliance.errorTaskLink': 'Could not link report with task.',
  },
};

const LanguageContext = createContext({
  lang: 'de',
  setLang: () => {},
  toggleLang: () => {},
  t: (key) => key,
});

function resolveInitialLanguage() {
  if (typeof window === 'undefined') return 'de';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'de' || saved === 'en') return saved;
  const browser = String(window.navigator?.language || '').toLowerCase();
  return browser.startsWith('en') ? 'en' : 'de';
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(resolveInitialLanguage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.setAttribute('lang', lang);
    }
  }, [lang]);

  const value = useMemo(() => {
    const t = (key, vars = {}) => {
      const raw = translations[lang]?.[key] ?? translations.de[key] ?? key;
      return Object.keys(vars).reduce((acc, varKey) => acc.replace(`{${varKey}}`, String(vars[varKey])), raw);
    };

    return {
      lang,
      setLang,
      toggleLang: () => setLang((prev) => (prev === 'de' ? 'en' : 'de')),
      t,
    };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
