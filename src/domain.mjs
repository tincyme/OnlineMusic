export const CLASS_PRICE_CENTS = 3500;

export function zoomUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'zoom.us' || url.hostname.endsWith('.zoom.us')) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function formatClassTime(iso, timeZone) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(iso));
}

export function routeFromHash(hash) {
  const route = hash.replace(/^#\/?/, '').split('?')[0];
  return ['student', 'teacher', 'admin'].includes(route) ? route : 'home';
}
