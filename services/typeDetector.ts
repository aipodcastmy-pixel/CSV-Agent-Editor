
import { ColumnType } from '../types';

// A simple regex for ISO-like dates (YYYY-MM-DD, YYYY/MM/DD)
const dateRegex = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;

const isNumericStrict = (val: any): boolean => {
  if (typeof val === 'string' && val.trim() === '') return false;
  // Exclude boolean strings from being considered numeric
  if (String(val).toLowerCase() === 'true' || String(val).toLowerCase() === 'false') return false;
  return !isNaN(parseFloat(val)) && isFinite(val);
}

const isDateStrict = (val: any): boolean => {
  if (typeof val !== 'string' || !val) return false;
  if (dateRegex.test(val)) {
    const d = new Date(val);
    // Check if the date is valid
    return d instanceof Date && !isNaN(d.getTime());
  }
  return false;
}

const isBooleanStrict = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    const lowerVal = String(val).toLowerCase();
    return lowerVal === 'true' || lowerVal === 'false';
}

export const inferColumnTypes = (rows: Record<string, any>[], headers: string[]): Record<string, ColumnType> => {
  const columnTypes: Record<string, ColumnType> = {};
  const sampleSize = Math.min(rows.length, 100); // Analyze up to 100 rows for performance

  if (sampleSize === 0) {
    headers.forEach(h => columnTypes[h] = 'string');
    return columnTypes;
  }

  for (const header of headers) {
    let isAllBoolean = true;
    let isAllNumeric = true;
    let isAllDate = true;
    let hasValues = false;

    for (let i = 0; i < sampleSize; i++) {
      const value = rows[i][header];
      if (value === null || value === undefined || String(value).trim() === '') {
        continue; // Skip empty values for type inference
      }
      hasValues = true;
      if (isAllBoolean && !isBooleanStrict(value)) isAllBoolean = false;
      if (isAllNumeric && !isNumericStrict(value)) isAllNumeric = false;
      if (isAllDate && !isDateStrict(value)) isAllDate = false;
    }

    if (!hasValues) {
        columnTypes[header] = 'string'; // Default to string for empty columns
    } else if (isAllBoolean) {
        columnTypes[header] = 'boolean';
    } else if (isAllNumeric) {
        columnTypes[header] = 'number';
    } else if (isAllDate) {
        columnTypes[header] = 'date';
    } else {
        columnTypes[header] = 'string';
    }
  }

  return columnTypes;
};