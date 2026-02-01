export const validators = {
  required: (value, fieldName) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return `${fieldName} is required`;
    }
    return null;
  },

  email: (value) => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Invalid email address';
  },

  dateRange: (startDate, endDate, fieldNames = { start: 'Start date', end: 'End date' }) => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end <= start) {
      return `${fieldNames.end} must be after ${fieldNames.start}`;
    }
    return null;
  },

  date: (value) => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? 'Invalid date' : null;
  },

  phone: (value) => {
    if (!value) return null;
    const phoneRegex = /^[\d\s\-\(\)\+\.]+$/;
    return phoneRegex.test(value) && value.replace(/\D/g, '').length >= 10
      ? null
      : 'Invalid phone number';
  },

  coordinates: (lat, lon) => {
    if (lat === null && lon === null) return null;
    if (lat === null || lon === null) return 'Both latitude and longitude are required';

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || isNaN(lonNum)) return 'Coordinates must be numbers';
    if (latNum < -90 || latNum > 90) return 'Latitude must be between -90 and 90';
    if (lonNum < -180 || lonNum > 180) return 'Longitude must be between -180 and 180';

    return null;
  },

  npi: (value) => {
    if (!value) return null;
    return /^\d{10}$/.test(value) ? null : 'NPI must be 10 digits';
  },

  url: (value) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return 'Invalid URL';
    }
  },

  minLength: (value, min, fieldName) => {
    if (!value) return null;
    return value.length >= min ? null : `${fieldName} must be at least ${min} characters`;
  },

  maxLength: (value, max, fieldName) => {
    if (!value) return null;
    return value.length <= max ? null : `${fieldName} must not exceed ${max} characters`;
  },

  number: (value, fieldName) => {
    if (value === null || value === '') return null;
    return isNaN(value) ? `${fieldName} must be a number` : null;
  },

  positiveNumber: (value, fieldName) => {
    const numError = validators.number(value, fieldName);
    if (numError) return numError;
    if (value <= 0) return `${fieldName} must be positive`;
    return null;
  }
};

export function validateForm(data, rules) {
  const errors = {};

  Object.entries(rules).forEach(([fieldName, validationRules]) => {
    const value = data[fieldName];

    if (Array.isArray(validationRules)) {
      for (const rule of validationRules) {
        if (typeof rule === 'function') {
          const error = rule(value);
          if (error) {
            errors[fieldName] = error;
            break;
          }
        }
      }
    } else if (typeof validationRules === 'function') {
      const error = validationRules(value);
      if (error) {
        errors[fieldName] = error;
      }
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function getFieldError(fieldName, errors) {
  return errors[fieldName] || null;
}

export function hasFieldError(fieldName, errors) {
  return !!errors[fieldName];
}
