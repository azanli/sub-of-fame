export type PostContentBlock =
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string };

type RtjsonTextNode = {
  e?: string;
  t?: string;
  u?: string;
};

type RtjsonBlockNode = {
  e?: string;
  c?: unknown;
  u?: string;
};

type MediaMetadataEntry = {
  e?: string;
  s?: { u?: string };
  p?: Array<{ u?: string }>;
  m?: string;
};

const htmlEntityPattern = /&(#x?[0-9a-f]+|[a-z]+);/gi;

const decodeHtmlEntities = (value: string): string =>
  value.replace(htmlEntityPattern, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    switch (entity.toLowerCase()) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
      case '#39':
        return "'";
      case 'nbsp':
        return ' ';
      default:
        return match;
    }
  });

export const stripHtmlToText = (html: string): string =>
  decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );

const extractTextFromRtjsonContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  const parts: string[] = [];
  for (const item of content) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const node = item as RtjsonTextNode;
    if (typeof node.t === 'string' && node.t.length > 0) {
      parts.push(node.t);
    }
  }

  return parts.join('').trim();
};

const resolveMediaMetadataUrl = (entry: MediaMetadataEntry | undefined): string | undefined => {
  if (entry === undefined) {
    return undefined;
  }

  if (entry.s?.u !== undefined && entry.s.u.length > 0) {
    return entry.s.u;
  }

  const preview = entry.p?.[entry.p.length - 1];
  if (preview?.u !== undefined && preview.u.length > 0) {
    return preview.u;
  }

  return undefined;
};

const resolveRtjsonMediaUrl = (
  node: RtjsonBlockNode,
  mediaMetadata: Record<string, MediaMetadataEntry> | undefined
): string | undefined => {
  if (typeof node.u === 'string' && node.u.length > 0) {
    return node.u;
  }

  const content = node.c;
  if (typeof content === 'string' && content.length > 0) {
    const metadataUrl = resolveMediaMetadataUrl(mediaMetadata?.[content]);
    if (metadataUrl !== undefined) {
      return metadataUrl;
    }
    return content;
  }

  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const textNode = item as RtjsonTextNode;
      if (typeof textNode.u === 'string' && textNode.u.length > 0) {
        return textNode.u;
      }
    }
  }

  return undefined;
};

const extractListText = (node: RtjsonBlockNode): string => {
  if (!Array.isArray(node.c)) {
    return '';
  }

  const lines: string[] = [];
  for (const item of node.c) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const listItem = item as RtjsonBlockNode;
    if (listItem.e !== 'li') {
      continue;
    }
    const line = extractTextFromRtjsonContent(listItem.c);
    if (line.length > 0) {
      lines.push(line);
    }
  }

  return lines.join('\n').trim();
};

export const parseRtjsonDocument = (
  rtjson: { document?: unknown[] },
  mediaMetadata?: Record<string, MediaMetadataEntry>,
  toLoadableImageUrl: (url: string) => string = (url) => url
): PostContentBlock[] => {
  const document = rtjson.document;
  if (!Array.isArray(document)) {
    return [];
  }

  const blocks: PostContentBlock[] = [];

  for (const nodeValue of document) {
    if (typeof nodeValue !== 'object' || nodeValue === null) {
      continue;
    }

    const node = nodeValue as RtjsonBlockNode;
    switch (node.e) {
      case 'par':
      case 'blockquote':
      case 'code':
      case 'heading': {
        const text = extractTextFromRtjsonContent(node.c);
        if (text.length > 0) {
          blocks.push({ kind: 'text', text });
        }
        break;
      }
      case 'h': {
        const text = extractTextFromRtjsonContent(node.c);
        if (text.length > 0) {
          blocks.push({ kind: 'text', text });
        }
        break;
      }
      case 'list': {
        const text = extractListText(node);
        if (text.length > 0) {
          blocks.push({ kind: 'text', text });
        }
        break;
      }
      case 'img':
      case 'gif':
      case 'video': {
        const mediaUrl = resolveRtjsonMediaUrl(node, mediaMetadata);
        if (mediaUrl !== undefined && mediaUrl.length > 0) {
          blocks.push({ kind: 'image', url: toLoadableImageUrl(mediaUrl) });
        }
        break;
      }
      default:
        break;
    }
  }

  return blocks;
};

export const parseBodyHtml = (
  bodyHtml: string,
  toLoadableImageUrl: (url: string) => string = (url) => url
): PostContentBlock[] => {
  const cleaned = bodyHtml.replace(/<!--[\s\S]*?-->/g, '').trim();
  if (cleaned.length === 0) {
    return [];
  }

  const blocks: PostContentBlock[] = [];
  const parts = cleaned.split(/(<img\b[^>]*>)/gi);

  for (const part of parts) {
    if (/^<img\b/i.test(part)) {
      const srcMatch = part.match(/\bsrc="([^"]+)"/i);
      if (srcMatch?.[1] !== undefined && srcMatch[1].length > 0) {
        blocks.push({ kind: 'image', url: toLoadableImageUrl(srcMatch[1]) });
      }
      continue;
    }

    const text = stripHtmlToText(part);
    if (text.length > 0) {
      blocks.push({ kind: 'text', text });
    }
  }

  return blocks;
};

export const blocksToPlainText = (blocks: PostContentBlock[]): string =>
  blocks
    .filter((block): block is Extract<PostContentBlock, { kind: 'text' }> => block.kind === 'text')
    .map((block) => block.text)
    .join('\n\n')
    .trim();

export const contentBlocksIncludeImages = (blocks: PostContentBlock[]): boolean =>
  blocks.some((block) => block.kind === 'image');
