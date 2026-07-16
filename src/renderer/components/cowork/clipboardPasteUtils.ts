type ClipboardDataReader = Pick<DataTransfer, 'getData'>;

export interface TextInsertionResult {
  value: string;
  caretPosition: number;
}

export const normalizeClipboardFileUrlPath = (rawPath: string): string | null => {
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.slice(0, 5).toLowerCase() !== 'file:') return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'file:') return null;
    let pathname = decodeURIComponent(url.pathname);
    if (url.hostname) {
      pathname = `//${url.hostname}${pathname}`;
    }
    if (/^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname || null;
  } catch {
    return null;
  }
};

export const containsClipboardFileUrl = (uriList: string): boolean => uriList
  .split(/\r?\n/)
  .map(line => line.trim())
  .some(line => line && !line.startsWith('#') && normalizeClipboardFileUrlPath(line) !== null);

const normalizeLocalPathForComparison = (
  rawPath: string,
  allowSurroundingQuotes = false,
): string | null => {
  const rawTrimmed = rawPath.trim();
  const trimmed = allowSurroundingQuotes
    && rawTrimmed.length >= 2
    && rawTrimmed.startsWith('"')
    && rawTrimmed.endsWith('"')
    ? rawTrimmed.slice(1, -1).trim()
    : rawTrimmed;
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;

  const fileUrlPath = normalizeClipboardFileUrlPath(trimmed);
  const localPath = fileUrlPath ?? trimmed;
  const isWindowsDrivePath = /^[A-Za-z]:[\\/]/.test(localPath);
  const isWindowsUncPath = /^(?:\\\\|\/\/)[^\\/]/.test(localPath);
  const isPosixPath = localPath.startsWith('/');
  if (!fileUrlPath && !isWindowsDrivePath && !isWindowsUncPath && !isPosixPath) {
    return null;
  }

  let normalized = localPath.replace(/\\/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.replace(/\/+$/, '');
  }
  if (isWindowsDrivePath || isWindowsUncPath || /^[A-Za-z]:\//.test(normalized)) {
    normalized = normalized.toLowerCase();
  }
  return normalized;
};

export const clipboardPlainTextMatchesLocalPath = (
  plainText: string,
  filePath: string,
  options?: { allowSurroundingQuotes?: boolean },
): boolean => {
  const normalizedPlainText = normalizeLocalPathForComparison(
    plainText,
    options?.allowSurroundingQuotes === true,
  );
  const normalizedFilePath = normalizeLocalPathForComparison(filePath);
  return normalizedPlainText !== null
    && normalizedFilePath !== null
    && normalizedPlainText === normalizedFilePath;
};

export const getClipboardFileUrlPath = (clipboardData: ClipboardDataReader | null): string | null => {
  const uriList = clipboardData?.getData('text/uri-list') ?? '';
  const uriCandidate = uriList
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#'));
  const plainText = clipboardData?.getData('text/plain') ?? '';
  if (uriCandidate) {
    const filePath = normalizeClipboardFileUrlPath(uriCandidate);
    if (!filePath) return null;

    // Rich clipboard payloads can include a file URI for a clickable path while
    // their plain text contains a compiler error, stack trace, or other prose.
    // Only treat URI-only clipboard data as an attachment when the plain text is
    // empty or represents that same single local path.
    if (plainText.trim() && !clipboardPlainTextMatchesLocalPath(plainText, filePath)) {
      return null;
    }
    return filePath;
  }
  return normalizeClipboardFileUrlPath(plainText);
};

export const insertTextAtSelection = (
  value: string,
  text: string,
  selectionStart: number,
  selectionEnd: number,
): TextInsertionResult => {
  const start = Math.max(0, Math.min(value.length, Math.min(selectionStart, selectionEnd)));
  const end = Math.max(start, Math.min(value.length, Math.max(selectionStart, selectionEnd)));
  return {
    value: `${value.slice(0, start)}${text}${value.slice(end)}`,
    caretPosition: start + text.length,
  };
};
