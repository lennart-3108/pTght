import React, { useState, useEffect } from 'react';

/**
 * Hierarchical Location Selector Component
 * Shows: Region/Area → Country → State → City
 * Props:
 *   - cities: array of city objects with {id, name, stateId, countryId}
 *   - countries: array of country objects with {id, name}
 *   - states: array of state objects with {id, name, countryId}
 *   - value: currently selected city name
 *   - onChange: callback(cityName, cityId, stateId, countryId)
 *   - placeholder: optional placeholder text (default: "Standort wählen")
 */
export default function LocationSelector({ cities = [], countries = [], states = [], value = '', onChange, placeholder = 'Standort wählen' }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState({});
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [selectedStateId, setSelectedStateId] = useState('');

  // Reset expanded states when dropdown closes
  useEffect(() => {
    if (!showDropdown) {
      setExpandedRegions({});
      setSelectedCountryId('');
      setSelectedStateId('');
    }
  }, [showDropdown]);

  // Auto-expand region/country/state when value is set
  useEffect(() => {
    if (value && cities.length > 0 && showDropdown) {
      const city = cities.find(c => c.name === value);
      if (city) {
        if (city.countryId) {
          const country = countries.find(co => String(co.id) === String(city.countryId));
          if (country) {
            const region = getRegion(country.name);
            setExpandedRegions(prev => ({ ...prev, [region]: true }));
            setSelectedCountryId(String(city.countryId));
          }
        }
        if (city.stateId) {
          setSelectedStateId(String(city.stateId));
        }
      }
    }
  }, [value, cities, countries, showDropdown]);

  // Region mapping
  const regionMap = {
    'Western Europe': ['Germany', 'France', 'Netherlands', 'Belgium', 'Luxembourg', 'Switzerland', 'Austria', 'Liechtenstein'],
    'Southern Europe': ['Italy', 'Spain', 'Portugal', 'Greece', 'Malta', 'Andorra', 'Monaco', 'San Marino', 'Holy See', 'Cyprus'],
    'Northern Europe': ['United Kingdom', 'Ireland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland', 'Estonia', 'Latvia', 'Lithuania'],
    'Eastern Europe': ['Poland', 'Czechia', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Serbia', 'Croatia', 'Slovenia', 'Bosnia and Herzegovina', 'Montenegro', 'North Macedonia', 'Albania', 'Belarus', 'Ukraine', 'Moldova', 'Russian Federation'],
    'Middle East': ['Türkiye', 'Iran', 'Iraq', 'Saudi Arabia', 'Yemen', 'Jordan', 'United Arab Emirates', 'Israel', 'Lebanon', 'Palestine, State of', 'Oman', 'Kuwait', 'Qatar', 'Bahrain', 'Syria', 'Armenia', 'Azerbaijan', 'Georgia'],
    'East Asia': ['China', 'Japan', 'Korea, Republic of', 'Korea, Democratic People\'s Republic of', 'Taiwan, Province of China', 'Hong Kong', 'Macao', 'Mongolia'],
    'Southeast Asia': ['Indonesia', 'Philippines', 'Viet Nam', 'Thailand', 'Myanmar', 'Malaysia', 'Singapore', 'Cambodia', 'Lao People\'s Democratic Republic', 'Timor-Leste', 'Brunei Darussalam'],
    'South Asia': ['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Sri Lanka', 'Afghanistan', 'Bhutan', 'Maldives'],
    'Central Asia': ['Uzbekistan', 'Tajikistan', 'Kyrgyzstan', 'Turkmenistan', 'Kazakhstan'],
    'North Africa': ['Egypt', 'Algeria', 'Morocco', 'Tunisia', 'Libya', 'Sudan', 'South Sudan', 'Western Sahara'],
    'West Africa': ['Nigeria', 'Ghana', 'Côte d\'Ivoire', 'Niger', 'Burkina Faso', 'Mali', 'Senegal', 'Guinea', 'Benin', 'Togo', 'Sierra Leone', 'Liberia', 'Mauritania', 'Gambia', 'Guinea-Bissau', 'Cabo Verde'],
    'East Africa': ['Ethiopia', 'Kenya', 'Uganda', 'Tanzania, United Republic of', 'Rwanda', 'Burundi', 'Somalia', 'Eritrea', 'Djibouti'],
    'Central Africa': ['Congo, Democratic Republic of the', 'Angola', 'Cameroon', 'Chad', 'Central African Republic', 'Gabon', 'Equatorial Guinea', 'Sao Tome and Principe'],
    'Southern Africa': ['South Africa', 'Mozambique', 'Madagascar', 'Malawi', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia', 'Lesotho', 'Eswatini', 'Mauritius', 'Comoros', 'Seychelles'],
    'North America': ['United States of America', 'Canada', 'Mexico', 'Greenland'],
    'Central America': ['Guatemala', 'Honduras', 'Nicaragua', 'El Salvador', 'Costa Rica', 'Panama', 'Belize'],
    'Caribbean': ['Cuba', 'Jamaica', 'Trinidad and Tobago', 'Bahamas', 'Barbados', 'Saint Lucia', 'Grenada', 'Saint Vincent and the Grenadines', 'Antigua and Barbuda', 'Dominica', 'Saint Kitts and Nevis', 'Haiti', 'Dominican Republic'],
    'South America': ['Brazil', 'Colombia', 'Argentina', 'Peru', 'Venezuela', 'Chile', 'Ecuador', 'Bolivia', 'Paraguay', 'Uruguay', 'Guyana', 'Suriname', 'French Guiana'],
    'Australia & New Zealand': ['Australia', 'New Zealand'],
    'Pacific Islands': ['Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu', 'New Caledonia', 'French Polynesia', 'Samoa', 'Guam', 'Kiribati', 'Micronesia', 'Tonga', 'Palau', 'Cook Islands', 'American Samoa', 'Northern Mariana Islands', 'Marshall Islands', 'Tuvalu', 'Nauru', 'Wallis and Futuna', 'Niue', 'Tokelau']
  };

  const getRegion = (countryName) => {
    for (const [region, countryList] of Object.entries(regionMap)) {
      if (countryList.includes(countryName)) {
        return region;
      }
    }
    return 'Other';
  };

  const groupedCountries = countries.reduce((acc, country) => {
    const region = getRegion(country.name);
    if (!acc[region]) acc[region] = [];
    acc[region].push(country);
    return acc;
  }, {});

  const regionOrder = [
    'Western Europe', 'Southern Europe', 'Northern Europe', 'Eastern Europe',
    'Middle East', 'East Asia', 'Southeast Asia', 'South Asia', 'Central Asia',
    'North Africa', 'West Africa', 'East Africa', 'Central Africa', 'Southern Africa',
    'North America', 'Central America', 'Caribbean', 'South America',
    'Australia & New Zealand', 'Pacific Islands',
    'Other'
  ];

  const handleCitySelect = (city) => {
    if (onChange) {
      onChange(city.name, city.id, city.stateId, city.countryId);
    }
    setShowDropdown(false);
  };

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #2f6b57',
    background: '#0b1e19',
    color: '#e8efe8',
    fontSize: 15,
    width: '100%',
    minWidth: 200
  };

  return (
    <div style={{ position: 'relative', zIndex: showDropdown ? 9999 : 1 }}>
      {/* Display field */}
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          ...inputStyle,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none'
        }}
      >
        <span style={{ color: value ? '#e8efe8' : '#9ca3af' }}>
          {value || placeholder}
        </span>
        <span style={{ fontSize: 12 }}>
          {showDropdown ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown menu */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#0b1e19',
          border: '1px solid #2f6b57',
          borderRadius: 10,
          maxHeight: 400,
          overflowY: 'auto',
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}>
          {regionOrder.map(region => {
            const regionCountries = groupedCountries[region] || [];
            if (regionCountries.length === 0) return null;

            const isRegionExpanded = expandedRegions[region];

            return (
              <div key={region}>
                {/* Region Header - Clickable */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedRegions(prev => ({
                      ...prev,
                      [region]: !prev[region]
                    }));
                  }}
                  style={{
                    padding: '10px 16px',
                    background: '#0a1e19',
                    borderBottom: '1px solid #2f6b57',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    color: '#9ca3af',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#0e2521'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#0a1e19'}
                >
                  <span style={{ fontSize: 10 }}>
                    {isRegionExpanded ? '▼' : '▶'}
                  </span>
                  {region}
                </div>

                {/* Countries in Region - Only show when expanded */}
                {isRegionExpanded && regionCountries.map(country => {
                  const isCountrySelected = String(country.id) === String(selectedCountryId);
                  const countryStates = states.filter(st => String(st.countryId) === String(country.id));
                  const countryCities = cities.filter(c => String(c.countryId) === String(country.id));

                  return (
                    <div key={country.id}>
                      {/* Country item */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isCountrySelected) {
                            setSelectedCountryId('');
                            setSelectedStateId('');
                          } else {
                            setSelectedCountryId(String(country.id));
                            setSelectedStateId('');
                          }
                        }}
                        style={{
                          padding: '12px 16px',
                          cursor: 'pointer',
                          background: isCountrySelected ? '#113528' : 'transparent',
                          borderBottom: '1px solid #1a3329',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 600,
                          color: '#e8efe8',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#113528'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isCountrySelected ? '#113528' : 'transparent'}
                      >
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>
                          {isCountrySelected ? '▼' : '▶'}
                        </span>
                        <span>{country.name}</span>
                      </div>

                      {/* States */}
                      {isCountrySelected && countryStates.length > 0 && countryStates.map(state => {
                        const isStateSelected = String(state.id) === String(selectedStateId);
                        const stateCities = cities.filter(c => String(c.stateId) === String(state.id));

                        return (
                          <div key={state.id}>
                            {/* State item */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isStateSelected) {
                                  setSelectedStateId('');
                                } else {
                                  setSelectedStateId(String(state.id));
                                }
                              }}
                              style={{
                                padding: '10px 16px 10px 32px',
                                cursor: 'pointer',
                                background: isStateSelected ? '#0e2521' : 'transparent',
                                borderBottom: '1px solid #1a3329',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 500,
                                color: '#cfe',
                                fontSize: 14,
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#0e2521'}
                              onMouseLeave={(e) => e.currentTarget.style.background = isStateSelected ? '#0e2521' : 'transparent'}
                            >
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>
                                {isStateSelected ? '▼' : '▶'}
                              </span>
                              <span>{state.name}</span>
                            </div>

                            {/* Cities in state */}
                            {isStateSelected && stateCities.map(city => (
                              <div
                                key={city.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCitySelect(city);
                                }}
                                style={{
                                  padding: '8px 16px 8px 48px',
                                  cursor: 'pointer',
                                  background: value === city.name ? '#0a1e19' : 'transparent',
                                  borderBottom: '1px solid #1a3329',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  color: value === city.name ? '#debc7c' : '#a6bfb3',
                                  fontSize: 13,
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#0a1e19';
                                  e.currentTarget.style.color = '#debc7c';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = value === city.name ? '#0a1e19' : 'transparent';
                                  e.currentTarget.style.color = value === city.name ? '#debc7c' : '#a6bfb3';
                                }}
                              >
                                <span style={{ fontSize: 10 }}>•</span>
                                <span>{city.name}</span>
                                {value === city.name && (
                                  <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* Cities without state */}
                      {isCountrySelected && countryStates.length === 0 && countryCities.map(city => (
                        <div
                          key={city.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCitySelect(city);
                          }}
                          style={{
                            padding: '8px 16px 8px 32px',
                            cursor: 'pointer',
                            background: value === city.name ? '#0a1e19' : 'transparent',
                            borderBottom: '1px solid #1a3329',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            color: value === city.name ? '#debc7c' : '#a6bfb3',
                            fontSize: 13,
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#0a1e19';
                            e.currentTarget.style.color = '#debc7c';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = value === city.name ? '#0a1e19' : 'transparent';
                            e.currentTarget.style.color = value === city.name ? '#debc7c' : '#a6bfb3';
                          }}
                        >
                          <span style={{ fontSize: 10 }}>•</span>
                          <span>{city.name}</span>
                          {value === city.name && (
                            <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
