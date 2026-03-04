import React from 'react';
import { useLanguage } from '../i18n';
import './SubscriptionsPage.css';

export default function SubscriptionsPage() {
  const { lang, t } = useLanguage();
  // MVP1: only FREE USER is active. All other roles exist architecturally but are disabled.
  const copy = {
    de: {
      freeDesc: 'Basisrolle – kostenlos. Matches erstellen, suchen, beitreten und chatten.',
      teamCaptainDesc: 'Team-Organisation (Team gründen, Mitglieder, Liga-Anmeldung).',
      clubOwnerDesc: 'Vereinsstruktur & mehrere Teams verwalten.',
      locationOwnerDesc: 'Sportanlagen & Plätze verwalten (Booking später).',
      eventOwnerDesc: 'Ligen & Turniere organisieren.',
      trainerDesc: 'Trainings planen, Gruppen verwalten, Leistung tracken.',
      adminDesc: 'Intern (Moderation/Support). Nicht buchbar.',
      freePlanDesc: 'Alles, was du für MVP1 brauchst.',
      comingSoon: 'Kommt bald',
    },
    en: {
      freeDesc: 'Base role – free. Create/search/join matches and chat.',
      teamCaptainDesc: 'Team organisation (create team, members, league registration).',
      clubOwnerDesc: 'Club structure & manage multiple teams.',
      locationOwnerDesc: 'Manage venues & courts (booking later).',
      eventOwnerDesc: 'Organise leagues & tournaments.',
      trainerDesc: 'Plan training, manage groups, track performance.',
      adminDesc: 'Internal (moderation/support). Not purchasable.',
      freePlanDesc: 'Everything you need for MVP1.',
      comingSoon: 'Coming soon',
    },
  };
  const c = copy[lang] || copy.de;

  const roles = [
    {
      id: 'free',
      name: 'free',
      display_name: 'FREE USER',
      description: c.freeDesc,
      mvp1_active: true,
    },
    {
      id: 'team_captain',
      name: 'team_captain',
      display_name: 'TEAM CAPTAIN',
      description: c.teamCaptainDesc,
      mvp1_active: false,
    },
    {
      id: 'club_owner',
      name: 'club_owner',
      display_name: 'CLUB OWNER',
      description: c.clubOwnerDesc,
      mvp1_active: false,
    },
    {
      id: 'location_owner',
      name: 'location_owner',
      display_name: 'LOCATION OWNER',
      description: c.locationOwnerDesc,
      mvp1_active: false,
    },
    {
      id: 'event_owner',
      name: 'event_owner',
      display_name: 'EVENT OWNER / LIGA MANAGER',
      description: c.eventOwnerDesc,
      mvp1_active: false,
    },
    {
      id: 'trainer',
      name: 'trainer',
      display_name: 'TRAINER',
      description: c.trainerDesc,
      mvp1_active: false,
    },
    {
      id: 'admin',
      name: 'admin',
      display_name: 'ADMIN',
      description: c.adminDesc,
      mvp1_active: true,
      internal: true,
    },
  ];

  const licensePlans = [
    {
      id: 'plan_free',
      role_name: 'free',
      role_display_name: 'FREE USER',
      name: 'Free (MVP1)',
      price: 0,
      billing_period: 'free',
      description: c.freePlanDesc,
      features: [
        lang === 'en' ? 'register / login' : 'registrieren / login',
        lang === 'en' ? 'edit profile' : 'profil bearbeiten',
        lang === 'en' ? 'choose sport & city' : 'sport & stadt wählen',
        lang === 'en' ? 'create match' : 'match erstellen',
        lang === 'en' ? 'search match' : 'match suchen',
        lang === 'en' ? 'join / leave match' : 'match beitreten / verlassen',
        lang === 'en' ? 'match chat' : 'match-chat nutzen',
        lang === 'en' ? 'match history' : 'eigene match-historie',
      ],
      limits: {},
      is_coming_soon: false,
    },
    {
      id: 'plan_team_captain',
      role_name: 'team_captain',
      role_display_name: 'TEAM CAPTAIN',
      name: 'Coming Soon',
      price: null,
      billing_period: 'coming_soon',
      description: lang === 'en' ? 'Coming soon – team features & organisation.' : 'Kommt bald – Team-Features & Organisation.',
      features: lang === 'en'
        ? ['create team', 'invite members', 'register team in league']
        : ['team gründen', 'mitglieder einladen', 'team in liga anmelden'],
      limits: {},
      is_coming_soon: true,
    },
    {
      id: 'plan_club_owner',
      role_name: 'club_owner',
      role_display_name: 'CLUB OWNER',
      name: 'Coming Soon',
      price: null,
      billing_period: 'coming_soon',
      description: lang === 'en' ? 'Coming soon – club structure & multiple teams.' : 'Kommt bald – Vereinsstruktur & mehrere Teams.',
      features: lang === 'en'
        ? ['manage multiple teams', 'assign coaches', 'club dashboard']
        : ['mehrere teams verwalten', 'trainer zuweisen', 'club-dashboard'],
      limits: {},
      is_coming_soon: true,
    },
    {
      id: 'plan_location_owner',
      role_name: 'location_owner',
      role_display_name: 'LOCATION OWNER',
      name: 'Coming Soon',
      price: null,
      billing_period: 'coming_soon',
      description: lang === 'en' ? 'Coming soon – venues/courts/slots (booking later).' : 'Kommt bald – Locations/Plätze/Slots (Booking später).',
      features: lang === 'en'
        ? ['create venue', 'define courts', 'generate slots']
        : ['location erstellen', 'plätze definieren', 'slots generieren'],
      limits: {},
      is_coming_soon: true,
    },
    {
      id: 'plan_event_owner',
      role_name: 'event_owner',
      role_display_name: 'EVENT OWNER / LIGA MANAGER',
      name: 'Coming Soon',
      price: null,
      billing_period: 'coming_soon',
      description: lang === 'en' ? 'Coming soon – organise leagues/tournaments.' : 'Kommt bald – Ligen/Turniere organisieren.',
      features: lang === 'en'
        ? ['create league', 'standings', 'configure tournaments']
        : ['liga erstellen', 'tabellen', 'turniere konfigurieren'],
      limits: {},
      is_coming_soon: true,
    },
    {
      id: 'plan_trainer',
      role_name: 'trainer',
      role_display_name: 'TRAINER',
      name: 'Coming Soon',
      price: null,
      billing_period: 'coming_soon',
      description: lang === 'en' ? 'Coming soon – training groups & tracking.' : 'Kommt bald – Trainingsgruppen & Tracking.',
      features: lang === 'en'
        ? ['plan training', 'manage participants', 'track performance data']
        : ['trainings planen', 'teilnehmer verwalten', 'leistungsdaten tracken'],
      limits: {},
      is_coming_soon: true,
    },
  ].filter(p => p.role_name !== 'admin');

  const getRoleIcon = (roleName) => {
    const icons = {
      free: '👤',
      team_captain: '⚽',
      club_owner: '🏛️',
      location_owner: '🏟️',
      event_owner: '🏆',
      trainer: '🎓',
      admin: '🛡️',
    };
    return icons[roleName] || '📋';
  };

  const getBillingPeriodLabel = (period) => {
    const labels = {
      free: t('subs.billing.free'),
      coming_soon: t('subs.billing.comingSoon'),
    };
    return labels[period] || period;
  };

  const groupedPlans = licensePlans.reduce((acc, plan) => {
    if (!acc[plan.role_name]) {
      acc[plan.role_name] = [];
    }
    acc[plan.role_name].push(plan);
    return acc;
  }, {});

  return (
    <div className="subscriptions-page">
      <div className="subscriptions-container">
        <div className="subscriptions-header">
          <h1>{t('subs.title')}</h1>
          <p className="subscriptions-subtitle">
            {t('subs.subtitle')}
          </p>
        </div>

        <div className="roles-section">
          <h2>{t('subs.rolesTitle')}</h2>
          <div className="roles-grid">
            {roles.map(role => {
              const plans = groupedPlans[role.name] || [];
              const isComingSoon = !role.mvp1_active && !role.internal;
              
              return (
                <div key={role.id} className={`role-card${isComingSoon ? ' role-card--coming-soon' : ''}${role.internal ? ' role-card--internal' : ''}`}>
                  <div className="role-card-header">
                    <span className="role-icon">{getRoleIcon(role.name)}</span>
                    <h3>{role.display_name}</h3>
                  </div>
                  <p className="role-description">{role.description}</p>
                  <div className="role-license-status">
                    {role.internal ? (
                      <span className="license-required">{t('badge.internal')}</span>
                    ) : isComingSoon ? (
                      <span className="license-coming-soon">{t('badge.comingSoon')}</span>
                    ) : (
                      <span className="license-free">{t('badge.active')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {Object.keys(groupedPlans).length > 0 && (
          <div className="plans-section">
            <h2>{t('subs.plansTitle')}</h2>
            
            {Object.entries(groupedPlans).map(([roleName, plans]) => {
              const role = roles.find(r => r.name === roleName);
              if (!role) return null;

              return (
                <div key={roleName} className="role-plans-group">
                  <h3 className="role-plans-title">
                    <span className="role-icon">{getRoleIcon(roleName)}</span>
                    {role.display_name}
                  </h3>
                  
                  <div className="plans-grid">
                    {plans.map(plan => (
                      <div key={plan.id} className={`plan-card${plan.is_coming_soon ? ' plan-card--coming-soon' : ''}`}>
                        <div className="plan-header">
                          <h4>{plan.name}</h4>
                          <div className="plan-price">
                            {plan.is_coming_soon ? (
                              <span className="price-amount">Coming Soon</span>
                            ) : (
                              <>
                                <span className="price-amount">€{plan.price}</span>
                                <span className="price-period">
                                  /{getBillingPeriodLabel(plan.billing_period)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {plan.description && (
                          <p className="plan-description">{plan.description}</p>
                        )}

                        {plan.features && plan.features.length > 0 && (
                          <div className="plan-features">
                            <h5>Funktionen:</h5>
                            <ul>
                              {plan.features.map((feature, idx) => (
                                <li key={idx}>✓ {feature}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {plan.limits && Object.keys(plan.limits).length > 0 && (
                          <div className="plan-limits">
                            <h5>Limits:</h5>
                            <ul>
                              {Object.entries(plan.limits).map(([key, value]) => (
                                <li key={key}>
                                  {key.replace(/_/g, ' ')}: {value}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {plan.duration_days && (
                          <div className="plan-duration">
                            Laufzeit: {plan.duration_days} Tage
                          </div>
                        )}

                        {plan.is_coming_soon && (
                          <div className="plan-coming-soon-overlay">
                            <div className="plan-coming-soon-text">{t('badge.comingSoon')}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="subscriptions-footer">
          <p>
            {t('subs.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}
