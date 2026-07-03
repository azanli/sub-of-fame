import { describe, expect, it } from 'vitest';
import {
  blocksToPlainText,
  contentBlocksIncludeImages,
  parseBodyHtml,
  parseRtjsonDocument,
  stripHtmlToText,
} from './postContent.js';

describe('parseRtjsonDocument', () => {
  it('preserves interleaved text and inline images in document order', () => {
    const blocks = parseRtjsonDocument(
      {
        document: [
          { e: 'par', c: [{ e: 'text', t: 'Before the image.' }] },
          { e: 'img', c: 'abc123' },
          { e: 'par', c: [{ e: 'text', t: 'After the image.' }] },
        ],
      },
      {
        abc123: {
          e: 'Image',
          s: { u: 'https://preview.redd.it/abc123.png' },
        },
      },
      () => 'https://i.redd.it/abc123.png'
    );

    expect(blocks).toEqual([
      { kind: 'text', text: 'Before the image.' },
      { kind: 'image', url: 'https://i.redd.it/abc123.png' },
      { kind: 'text', text: 'After the image.' },
    ]);
    expect(blocksToPlainText(blocks)).toBe('Before the image.\n\nAfter the image.');
    expect(contentBlocksIncludeImages(blocks)).toBe(true);
  });
});

describe('parseBodyHtml', () => {
  it('extracts text and images from reddit selftext html in order', () => {
    const blocks = parseBodyHtml(
      '<!-- SC_OFF --><div class="md"><p>Intro text</p><p><img src="https://preview.redd.it/image.png?width=640" /></p><p>Outro text</p></div><!-- SC_ON -->',
      (url) => url.replace('preview.redd.it', 'i.redd.it').replace(/\?.*$/, '')
    );

    expect(blocks).toEqual([
      { kind: 'text', text: 'Intro text' },
      { kind: 'image', url: 'https://i.redd.it/image.png' },
      { kind: 'text', text: 'Outro text' },
    ]);
  });
});

describe('stripHtmlToText', () => {
  it('decodes common html entities', () => {
    expect(stripHtmlToText('<p>Tom &amp; Jerry</p>')).toBe('Tom & Jerry');
  });
});
