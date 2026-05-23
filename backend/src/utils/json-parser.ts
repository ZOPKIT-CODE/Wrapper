/**
 * Safely parse JSON data that might be stored as objects or strings
 * Handles the case where Drizzle ORM returns JavaScript objects directly
 * vs when data is stored as JSON strings
 */

import Logger from './logger.js';

export function safeJsonParse<T = Record<string, unknown>>(data: unknown, fallback: T = {} as T, fieldName = 'data'): T {
  try {
    // If data is null or undefined, return fallback
    if (data === null || data === undefined) {
      return fallback;
    }

    // If data is already an object (and not a string), return it directly
    if (typeof data === 'object' && data !== null) {
      Logger.log('info', 'utils', 'json-parse', `${fieldName} is already an object, using directly`);
      return data as T;
    }

    // If data is a string, try to parse it
    if (typeof data === 'string') {
      if (data.trim() === '') {
        Logger.log('warning', 'utils', 'json-parse', `${fieldName} is empty string, using fallback`);
        return fallback;
      }

      Logger.log('debug', 'utils', 'json-parse', `Parsing ${fieldName} from string`);
      return JSON.parse(data) as T;
    }

    // For any other data type, log warning and return fallback
    Logger.log('warning', 'utils', 'json-parse', `Unexpected data type for ${fieldName}`, { dataType: typeof data });
    return fallback;

  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'utils', 'json-parse', `Failed to parse ${fieldName}`, {
      error: error.message,
      dataType: typeof data,
      dataPreview: typeof data === 'string' ? data.substring(0, 100) : String(data).substring(0, 100)
    });
    return fallback;
  }
}

/**
 * Parse role permissions with proper error handling
 */
export function parseRolePermissions(permissions: unknown): Record<string, unknown> {
  return safeJsonParse(permissions, {}, 'permissions');
}

/**
 * Parse role restrictions with proper error handling
 */
export function parseRoleRestrictions(restrictions: unknown): Record<string, unknown> {
  return safeJsonParse(restrictions, {}, 'restrictions');
}

/**
 * Parse role metadata with proper error handling
 */
export function parseRoleMetadata(metadata: unknown): Record<string, unknown> {
  return safeJsonParse(metadata, {}, 'metadata');
}

/**
 * Safely stringify data for database storage
 */
export function safeJsonStringify(data: unknown, fieldName = 'data'): string | null {
  try {
    if (data === null || data === undefined) {
      return null;
    }

    // If it's already a string, return it
    if (typeof data === 'string') {
      // Validate it's valid JSON
      JSON.parse(data);
      return data;
    }

    // Convert object to JSON string
    return JSON.stringify(data);

  } catch (err: unknown) {
    const error = err as Error;
    Logger.log('error', 'utils', 'json-stringify', `Failed to stringify ${fieldName}`, {
      error: error.message,
      dataType: typeof data
    });
    return null;
  }
}