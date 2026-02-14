import React, { useState, useEffect } from 'react';

/**
 * Hierarchical Location Selector Component
 * Shows: Country → State → City → District
 */
export default function LocationSelector({ 
  cities = [], 
  countries = [], 
  states = [], 
  districts = [], 
  value = '', 
  onChange, 
  onLoadDistricts, 
  onLoadCities,
  placeholder = 'Standort wählen',
  onOpen,
  isOpen,
  onClose
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const [expandedStates, setExpandedStates] = useState(new Set());
  const [expandedCities, setExpandedCities] = useState(new Set());

  // External control of dropdown state
  useEffect(() => {
    if (isOpen !== undefined) {
      setShowDropdown(isOpen);
    }
  }, [isOpen]);

  // Debug logging only in non-production
  useEffect(() => {
    if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') return;
    console.log('[LocationSelector] Props received:', {
      countries: countries.length,
      states: states.length,
      cities: cities.length,
      districts: districts.length,
      statesSample: states.slice(0, 2)
    });
  }, [countries, states, cities, districts]);

  // Reset when dropdown closes
  useEffect(() => {
    if (!showDropdown) {
      setExpandedCountries(new Set());
      setExpandedStates(new Set());
      setExpandedCities(new Set());
      if (onClose) onClose();
    }
  }, [showDropdown, onClose]);

  const toggleCountry = (countryId) => {
    const newSet = new Set(expandedCountries);
    if (newSet.has(countryId)) {
      newSet.delete(countryId);
    } else {
      newSet.add(countryId);
    }
    setExpandedCountries(newSet);
  };

  const toggleState = (stateId) => {
    const newSet = new Set(expandedStates);
    if (newSet.has(stateId)) {
      newSet.delete(stateId);
    } else {
      newSet.add(stateId);
      if (onLoadCities) {
        onLoadCities(stateId);
      }
    }
    setExpandedStates(newSet);
  };

  const toggleCity = (cityId) => {
    const newSet = new Set(expandedCities);
    if (newSet.has(cityId)) {
      newSet.delete(cityId);
    } else {
      newSet.add(cityId);
      if (onLoadDistricts) {
        onLoadDistricts(cityId);
      }
    }
    setExpandedCities(newSet);
  };

  const selectCity = (city) => {
    if (onChange) {
      onChange(city.name, city.id, city.stateId, city.countryId, null);
    }
    setShowDropdown(false);
  };

  const selectDistrict = (district, city) => {
    if (onChange) {
      onChange(district.name, city.id, city.stateId, city.countryId, district.id);
    }
    setShowDropdown(false);
  };

  const inputStyle = {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(222, 188, 124, 0.28)',
    background: 'var(--ml-bg-elevated, #102820)',
    color: 'var(--ml-text-main, #e8efe8)',
    fontSize: 15,
    width: '100%',
    minWidth: 200
  };

  return (
    <div style={{ position: 'relative', zIndex: showDropdown ? 99999 : 1 }}>
      {/* Display field */}
      <div
        onClick={() => {
          const newState = !showDropdown;
          setShowDropdown(newState);
          if (newState && onOpen) {
            onOpen();
          }
        }}
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
          background: 'var(--ml-bg-surface, #0b1e19)',
          border: '1px solid rgba(222, 188, 124, 0.22)',
          borderRadius: 10,
          maxHeight: 400,
          overflowY: 'auto',
          zIndex: 100000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          padding: '8px 0'
        }}>
          {[...countries].sort((a, b) => a.name.localeCompare(b.name)).map(country => {
            const countryId = String(country.id);
            const isExpanded = expandedCountries.has(countryId);
            const countryStates = states.filter(s => String(s.countryId) === countryId);

            return (
              <div key={countryId}>
                {/* Country */}
                <div
                  onClick={() => toggleCountry(countryId)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: isExpanded ? '#113528' : 'transparent',
                    borderBottom: '1px solid #1a3329',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 600,
                    color: '#e8efe8'
                  }}
                >
                  <span style={{ fontSize: 10, color: '#9ca3af' }}>
                    {isExpanded ? '▼' : '▶'}
                  </span>
                  <span>{country.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b8578' }}>
                    {countryStates.length}
                  </span>
                </div>

                {/* States */}
                {isExpanded && countryStates.map(state => {
                  const stateId = String(state.id);
                  const isStateExpanded = expandedStates.has(stateId);
                  const stateCities = cities.filter(c => String(c.stateId) === stateId);

                  return (
                    <div key={stateId}>
                      {/* State */}
                      <div
                        onClick={() => toggleState(stateId)}
                        style={{
                          padding: '10px 16px 10px 32px',
                          cursor: 'pointer',
                          background: isStateExpanded ? '#0e2521' : 'transparent',
                          borderBottom: '1px solid #1a3329',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 500,
                          color: '#ccffee',
                          fontSize: 14
                        }}
                      >
                        <span style={{ fontSize: 10, color: '#9ca3af' }}>
                          {isStateExpanded ? '▼' : '▶'}
                        </span>
                        <span>{state.name}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b8578' }}>
                          {stateCities.length}
                        </span>
                      </div>

                      {/* Cities */}
                      {isStateExpanded && stateCities.map(city => {
                        const cityId = String(city.id);
                        const isCityExpanded = expandedCities.has(cityId);
                        const cityDistricts = districts.filter(d => 
                          String(d.parentCityId || d.cityId) === cityId
                        );
                        const hasDistricts = cityDistricts.length > 0;
                        const isSelected = value === city.name;

                        return (
                          <div key={cityId}>
                            {/* City */}
                            <div
                              onClick={() => {
                                if (hasDistricts) {
                                  toggleCity(cityId);
                                } else {
                                  selectCity(city);
                                }
                              }}
                              style={{
                                padding: '8px 16px 8px 44px',
                                cursor: 'pointer',
                                background: isSelected ? '#0a1e19' : 'transparent',
                                borderBottom: '1px solid #1a3329',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                color: isSelected ? '#debc7c' : '#a6bfb3',
                                fontSize: 13
                              }}
                            >
                              <span style={{ fontSize: 10, color: '#9ca3af' }}>
                                {hasDistricts ? (isCityExpanded ? '▼' : '▶') : '•'}
                              </span>
                              <span>{city.name}</span>
                              {isSelected && !hasDistricts && (
                                <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>
                              )}
                              {hasDistricts && (
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b8578' }}>
                                  {cityDistricts.length}
                                </span>
                              )}
                            </div>

                            {/* Districts */}
                            {isCityExpanded && cityDistricts.map(district => {
                              const isDistrictSelected = value === district.name;

                              return (
                                <div
                                  key={district.id}
                                  onClick={() => selectDistrict(district, city)}
                                  style={{
                                    padding: '6px 16px 6px 60px',
                                    cursor: 'pointer',
                                    background: isDistrictSelected ? '#05120e' : 'transparent',
                                    borderBottom: '1px solid #1a3329',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    color: isDistrictSelected ? '#debc7c' : '#8fa89d',
                                    fontSize: 12
                                  }}
                                >
                                  <span style={{ fontSize: 10 }}>•</span>
                                  <span>{district.name}</span>
                                  {isDistrictSelected && (
                                    <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
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
