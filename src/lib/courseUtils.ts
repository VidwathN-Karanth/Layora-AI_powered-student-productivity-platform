export function getPlatformDisplay(urlOrPlatform: string): string {
  if (!urlOrPlatform) return 'Self-Study';
  const trimmed = urlOrPlatform.trim();
  // If it doesn't look like a URL (no slashes, no dots), return it as is
  if (!trimmed.includes('.') && !trimmed.includes('/')) {
    return trimmed;
  }
  try {
    let urlStr = trimmed;
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = 'https://' + urlStr;
    }
    const hostname = new URL(urlStr).hostname;
    return hostname.replace(/^www\./i, '');
  } catch (e) {
    return trimmed;
  }
}

export function formatCourseLink(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return 'https://' + trimmed;
  }
  return trimmed;
}
