import React, { useState, useEffect } from 'react';

/**
 * Hierarchical Sport Selector Component
 * Shows: Category → Sport → Variant
 * Props:
 *   - sports: array of categories from /api/sports/categories with nested sports and variants
 *   - value: currently selected sport name
 *   - onChange: callback(sportName, sportId)
 *   - placeholder: optional placeholder text (default: "Sportart wählen")
 */
export default function SportSelector({ sports = [], value = '', onChange, placeholder = 'Sportart wählen' }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedSports, setExpandedSports] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  // Reset expanded states when dropdown closes
  useEffect(() => {
    if (!showDropdown) {
      setExpandedCategories({});
      setExpandedSports({});
      setSearchQuery('');
    }
  }, [showDropdown]);

  // Auto-expand category/sport when value is set
  useEffect(() => {
    if (value && sports.length > 0 && showDropdown) {
      // Find the selected sport in the hierarchy
      for (const category of sports) {
        for (const sport of category.sports || []) {
          if (sport.name === value) {
            setExpandedCategories(prev => ({ ...prev, [category.id]: true }));
            return;
          }
          for (const variant of sport.variants || []) {
            if (variant.name === value) {
              setExpandedCategories(prev => ({ ...prev, [category.id]: true }));
              setExpandedSports(prev => ({ ...prev, [sport.id]: true }));
              return;
            }
          }
        }
      }
    }
  }, [value, sports, showDropdown]);

  // Filter by search query
  const matchesSearch = (name) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return name.toLowerCase().includes(query);
  };

  const handleSportSelect = (sport) => {
    if (onChange) {
      onChange(sport.name, sport.id);
    }
    setShowDropdown(false);
  };

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const toggleSport = (sportId) => {
    setExpandedSports(prev => ({ ...prev, [sportId]: !prev[sportId] }));
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
    <div style={{ position: 'relative', zIndex: showDropdown ? 99999 : 1 }}>
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
          zIndex: 100000,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #2f6b57' }}>
            <input
              type="text"
              placeholder="Suche..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: '#0d2422',
                border: '1px solid #2f6b57',
                borderRadius: 6,
                color: '#e8efe8',
                fontSize: 13,
                outline: 'none'
              }}
            />
          </div>

          {/* Hierarchical list */}
          <div style={{ padding: '4px 0' }}>
            {sports
              .filter(category => {
                // Show category if it matches search or any of its children match
                if (matchesSearch(category.name)) return true;
                const childSports = category.sports || [];
                return childSports.some(s => matchesSearch(s.name)) || 
                       childSports.some(s => (s.variants || []).some(v => matchesSearch(v.name)));
              })
              .map(category => {
                const childSports = (category.sports || []).filter(s => matchesSearch(s.name));
                const isExpanded = expandedCategories[category.id];

                return (
                  <div key={category.id}>
                    {/* Category header */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategory(category.id);
                      }}
                      style={{
                        padding: '10px 16px',
                        cursor: 'pointer',
                        background: isExpanded ? '#0d2422' : 'transparent',
                        borderLeft: isExpanded ? '3px solid #debc7c' : '3px solid transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontWeight: 600,
                        color: '#debc7c',
                        fontSize: 14
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#0d2422'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isExpanded ? '#0d2422' : 'transparent'}
                    >
                      <span>{category.icon || '📁'} {category.name}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>

                    {/* Sports in category */}
                    {isExpanded && childSports.map(sport => {
                      const variants = (sport.variants || []).filter(v => matchesSearch(v.name));
                      const hasVariants = variants.length > 0;
                      const isSportExpanded = expandedSports[sport.id];

                      return (
                        <div key={sport.id}>
                          {/* Sport item */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasVariants) {
                                toggleSport(sport.id);
                              } else {
                                handleSportSelect(sport);
                              }
                            }}
                            style={{
                              padding: '8px 16px 8px 32px',
                              cursor: 'pointer',
                              background: value === sport.name ? '#2f6b57' : 'transparent',
                              borderLeft: '3px solid transparent',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              color: '#e8efe8',
                              fontSize: 13
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = value === sport.name ? '#2f6b57' : '#0d2422'}
                            onMouseLeave={(e) => e.currentTarget.style.background = value === sport.name ? '#2f6b57' : 'transparent'}
                          >
                            <span>
                              {hasVariants ? '📂' : '🏃'} {sport.name}
                            </span>
                            {hasVariants && (
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                                {isSportExpanded ? '▼' : '▶'}
                              </span>
                            )}
                          </div>

                          {/* Variants */}
                          {hasVariants && isSportExpanded && variants.map(variant => (
                            <div
                              key={variant.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSportSelect(variant);
                              }}
                              style={{
                                padding: '6px 16px 6px 48px',
                                cursor: 'pointer',
                                background: value === variant.name ? '#2f6b57' : 'transparent',
                                borderLeft: '3px solid transparent',
                                color: '#e8efe8',
                                fontSize: 12
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = value === variant.name ? '#2f6b57' : '#0d2422'}
                              onMouseLeave={(e) => e.currentTarget.style.background = value === variant.name ? '#2f6b57' : 'transparent'}
                            >
                              ⚡ {variant.name}
                              {variant.category && (
                                <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 11 }}>
                                  ({variant.category})
                                </span>
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
        </div>
      )}
    </div>
  );
}
