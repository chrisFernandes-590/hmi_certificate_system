/**
 * SecureStore abstraction for persisting the native access token.
 * Uses expo-secure-store, which encrypts values in the device keystore.
 * Never store tokens in AsyncStorage or plain local storage.
 */

import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'hmi.accessToken'

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    /* ignore deletion errors */
  }
}
