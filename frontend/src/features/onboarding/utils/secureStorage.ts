/**
 * Secure Storage Utilities for Onboarding Form Data
 * Provides encryption/decryption for sensitive form data stored in localStorage
 */

const STORAGE_SALT = 'onboarding_secure_v1'

/**
 * Simple encryption using base64 encoding with salt
 * Note: In production, use proper encryption like AES-GCM
 */
export const encryptData = (data: unknown): string => {
  try {
    const jsonString = JSON.stringify(data)
    const saltedData = `${STORAGE_SALT}${jsonString}${STORAGE_SALT}`
    return btoa(encodeURIComponent(saltedData))
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt data with validation
 */
export const decryptData = (encryptedData: string): unknown => {
  try {
    const decoded = decodeURIComponent(atob(encryptedData))
    const expectedPrefix = STORAGE_SALT
    const expectedSuffix = STORAGE_SALT

    if (
      !decoded.startsWith(expectedPrefix) ||
      !decoded.endsWith(expectedSuffix)
    ) {
      throw new Error('Invalid encrypted data format')
    }

    const jsonString = decoded.slice(
      expectedPrefix.length,
      -expectedSuffix.length
    )
    return JSON.parse(jsonString)
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Generate checksum for data integrity validation
 */
export const generateChecksum = (data: unknown): string => {
  const jsonString = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Validate data integrity using checksum
 */
export const validateDataIntegrity = (
  data: unknown,
  checksum: string
): boolean => {
  try {
    const calculatedChecksum = generateChecksum(data)
    return calculatedChecksum === checksum
  } catch (error) {
    console.error('Integrity validation failed:', error)
    return false
  }
}

/**
 * Securely store data with encryption and integrity check
 */
export const secureStore = (key: string, data: unknown): void => {
  try {
    const checksum = generateChecksum(data)
    const secureData = {
      data: encryptData(data),
      checksum,
      timestamp: new Date().toISOString(),
      version: '1.0',
    }
    sessionStorage.setItem(key, JSON.stringify(secureData))
  } catch (error) {
    console.error('Secure storage failed:', error)
    throw new Error('Failed to securely store data')
  }
}

/**
 * Securely retrieve and validate data
 */
export const secureRetrieve = (key: string): unknown | null => {
  try {
    const storedData = sessionStorage.getItem(key)
    if (!storedData) return null

    const secureData = JSON.parse(storedData)

    // Validate structure
    if (!secureData.data || !secureData.checksum || !secureData.version) {
      throw new Error('Invalid secure data structure')
    }

    // Decrypt data
    const decryptedData = decryptData(secureData.data)

    // Validate integrity
    if (!validateDataIntegrity(decryptedData, secureData.checksum)) {
      throw new Error('Data integrity check failed')
    }

    return decryptedData
  } catch (error) {
    console.error('Secure retrieval failed:', error)
    // Clean up corrupted data
    sessionStorage.removeItem(key)
    return null
  }
}

/**
 * Clear secure data
 */
export const secureClear = (key: string): void => {
  try {
    sessionStorage.removeItem(key)
  } catch (error) {
    console.error('Secure clear failed:', error)
  }
}
