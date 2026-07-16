import { describe, expect, test } from 'vitest';

import {
  containsClipboardFileUrl,
  getClipboardFileUrlPath,
  insertTextAtSelection,
  normalizeClipboardFileUrlPath,
} from './clipboardPasteUtils';

const createClipboardData = (values: Record<string, string>): Pick<DataTransfer, 'getData'> => ({
  getData: type => values[type] ?? '',
});

describe('clipboard file URL handling', () => {
  test('normalizes a Windows file URL', () => {
    expect(normalizeClipboardFileUrlPath('file:///D:/work/My%20Project')).toBe('D:/work/My Project');
  });

  test('preserves a Windows UNC host when normalizing a file URL', () => {
    expect(normalizeClipboardFileUrlPath('file://fileserver/shared/project')).toBe('//fileserver/shared/project');
  });

  test('detects file URLs in a URI list without treating comments as entries', () => {
    expect(containsClipboardFileUrl('# file:///ignored\nfile:///Users/test/project')).toBe(true);
    expect(containsClipboardFileUrl('# file:///ignored\nhttps://example.com')).toBe(false);
  });

  test('does not classify plain Windows diagnostic text as a file URL', () => {
    const diagnostic = [
      'D:\\securepass-android-20260616-2247\\app\\src\\main\\java\\com\\securepass\\app\\ProtectionOverlayActivity.java:50: 错误: 批注接口不适用于此类型的声明',
      '    @Override',
      '    ^',
    ].join('\n');
    const clipboardData = createClipboardData({ 'text/plain': diagnostic });

    expect(getClipboardFileUrlPath(clipboardData)).toBeNull();
  });

  test('prefers rich plain text over a file URI supplied for its clickable path', () => {
    const diagnostic = [
      'D:\\securepass-android-20260616-2247\\app\\src\\main\\java\\com\\securepass\\app\\ProtectionOverlayActivity.java:50: 错误: 批注接口不适用于此类型的声明',
      '    @Override',
      '    ^',
    ].join('\n');
    const clipboardData = createClipboardData({
      'text/uri-list': 'file:///D:/securepass-android-20260616-2247/app/src/main/java/com/securepass/app/ProtectionOverlayActivity.java',
      'text/plain': diagnostic,
    });

    expect(getClipboardFileUrlPath(clipboardData)).toBeNull();
  });

  test('keeps URI-only folder paste support when plain text is the same Windows path', () => {
    const clipboardData = createClipboardData({
      'text/uri-list': 'file:///D:/securepass/app',
      'text/plain': 'D:\\securepass\\app',
    });

    expect(getClipboardFileUrlPath(clipboardData)).toBe('D:/securepass/app');
  });

  test('keeps URI-only folder paste support when plain text is empty', () => {
    const clipboardData = createClipboardData({
      'text/uri-list': 'file:///home/user/project',
    });

    expect(getClipboardFileUrlPath(clipboardData)).toBe('/home/user/project');
  });

  test('keeps macOS URI-only folder paste support when plain text is the same path', () => {
    const clipboardData = createClipboardData({
      'text/uri-list': 'file:///Users/test/My%20Project',
      'text/plain': '/Users/test/My Project',
    });

    expect(getClipboardFileUrlPath(clipboardData)).toBe('/Users/test/My Project');
  });
});

describe('paste text fallback', () => {
  test('inserts clipboard text at the captured selection', () => {
    expect(insertTextAtSelection('before selected after', 'replacement', 7, 15)).toEqual({
      value: 'before replacement after',
      caretPosition: 18,
    });
  });

  test('clamps stale selection offsets to the current value', () => {
    expect(insertTextAtSelection('draft', ' text', 99, 99)).toEqual({
      value: 'draft text',
      caretPosition: 10,
    });
  });
});
