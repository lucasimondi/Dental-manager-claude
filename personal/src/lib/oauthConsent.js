export const isPersonalConsentPath = (pathname) => /^\/oauth\/consent\/?$/.test(pathname);

export function authorizationIdFromSearch(search) {
  const values = new URLSearchParams(search).getAll('authorization_id');
  if (values.length !== 1 || !/^[a-zA-Z0-9_-]{1,256}$/.test(values[0])) {
    throw new Error('Collegamento non valido. Riavvialo da ChatGPT.');
  }
  return values[0];
}

// Only Supabase-returned destinations reach this function, never query return URLs.
export function consentRedirectUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Destinazione del collegamento non valida.');
  }
  return url.href;
}
