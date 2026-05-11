export const conciergeUrl = (documentId: string): string =>
  `https://concierge.npr.org/#/doc/${encodeURIComponent(documentId)}`;
