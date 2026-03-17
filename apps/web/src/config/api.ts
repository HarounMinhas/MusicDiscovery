const DEFAULT_API_PREFIX = '/api';
const DEFAULT_RENDER_API_ORIGIN = 'https://harounminhas-github-io.onrender.com';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function getApiPrefix(): string {
  const configuredPrefix = import.meta.env.VITE_API_PREFIX?.trim();
  const prefix = configuredPrefix && configuredPrefix.length > 0 ? configuredPrefix : DEFAULT_API_PREFIX;
  return trimTrailingSlash(prefix) || DEFAULT_API_PREFIX;
}

export function getApiOrigin(): string {
  const configuredOrigin = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configuredOrigin) {
    return trimTrailingSlash(configuredOrigin);
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const host = window.location.hostname.toLowerCase();
  const isPortfolioHost =
    host === 'harounminhas.be' ||
    host.endsWith('.harounminhas.be') ||
    host === 'harounminhas.github.io';

  if (isPortfolioHost) {
    return DEFAULT_RENDER_API_ORIGIN;
  }

  return window.location.origin;
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiOrigin()}${getApiPrefix()}${normalizedPath}`;
}

