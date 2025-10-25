/**
 * Validation utilities
 */

const moment = require('moment-timezone');

/**
 * Validate timezone string (IANA timezone)
 */
function validateTimezone(tz) {
  if (!tz || typeof tz !== 'string') {
    return false;
  }
  
  try {
    // Check if timezone is valid by trying to use it
    const test = moment.tz('2025-01-01', tz);
    return test.isValid();
  } catch (e) {
    return false;
  }
}

/**
 * Validate coordinates (latitude, longitude)
 */
function validateCoordinates(lat, lng) {
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);
  
  if (isNaN(latitude) || isNaN(longitude)) {
    return false;
  }
  
  // Latitude must be between -90 and 90
  if (latitude < -90 || latitude > 90) {
    return false;
  }
  
  // Longitude must be between -180 and 180
  if (longitude < -180 || longitude > 180) {
    return false;
  }
  
  return true;
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (basic check)
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Allow digits, spaces, +, -, (, )
  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 7;
}

/**
 * Validate opening hours structure
 */
function validateOpeningHours(hours) {
  if (!hours || typeof hours !== 'object') {
    return false;
  }
  
  const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  
  for (const day of validDays) {
    if (hours[day]) {
      if (!Array.isArray(hours[day])) {
        return false;
      }
      
      for (const period of hours[day]) {
        if (!period.from || !period.to) {
          return false;
        }
        
        if (!timeRegex.test(period.from) || !timeRegex.test(period.to)) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Validate price (must be non-negative number)
 */
function validatePrice(price) {
  const num = parseFloat(price);
  return !isNaN(num) && num >= 0;
}

/**
 * Validate currency code (ISO 4217)
 */
function validateCurrency(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  const validCurrencies = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK'];
  return validCurrencies.includes(code.toUpperCase());
}

/**
 * Sanitize string input (remove HTML tags, trim)
 */
function sanitizeString(str, maxLength = null) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  
  // Remove HTML tags
  let clean = str.replace(/<[^>]*>/g, '');
  
  // Trim whitespace
  clean = clean.trim();
  
  // Limit length if specified
  if (maxLength && clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }
  
  return clean;
}

module.exports = {
  validateTimezone,
  validateCoordinates,
  validateEmail,
  validatePhone,
  validateOpeningHours,
  validatePrice,
  validateCurrency,
  sanitizeString,
};
