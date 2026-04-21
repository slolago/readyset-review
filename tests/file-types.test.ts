import { describe, it, expect } from 'vitest';
import { isAcceptedMime } from '@/lib/file-types';

describe('isAcceptedMime (SEC-23)', () => {
  it('accepts video/* wildcard', () => {
    expect(isAcceptedMime('video/mp4')).toBe(true);
    expect(isAcceptedMime('video/quicktime')).toBe(true);
    expect(isAcceptedMime('VIDEO/MP4')).toBe(true); // case insensitive
  });

  it('accepts image/* wildcard', () => {
    expect(isAcceptedMime('image/png')).toBe(true);
    expect(isAcceptedMime('image/webp')).toBe(true);
  });

  it('accepts exact matches', () => {
    expect(isAcceptedMime('application/pdf')).toBe(true);
    expect(isAcceptedMime('application/zip')).toBe(true);
    expect(isAcceptedMime('application/x-zip-compressed')).toBe(true);
    expect(isAcceptedMime('text/html')).toBe(true);
    expect(isAcceptedMime('font/woff2')).toBe(true);
  });

  it('ignores charset parameters', () => {
    expect(isAcceptedMime('text/html; charset=utf-8')).toBe(true);
    expect(isAcceptedMime('application/pdf; version=1.7')).toBe(true);
  });

  it('rejects unknown types', () => {
    expect(isAcceptedMime('application/octet-stream')).toBe(false);
    expect(isAcceptedMime('application/x-msdownload')).toBe(false);
    expect(isAcceptedMime('text/plain')).toBe(false);
    expect(isAcceptedMime('application/javascript')).toBe(false);
  });

  it('rejects empty/null/undefined', () => {
    expect(isAcceptedMime('')).toBe(false);
    expect(isAcceptedMime(null)).toBe(false);
    expect(isAcceptedMime(undefined)).toBe(false);
  });
});
