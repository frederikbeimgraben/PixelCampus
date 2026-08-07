/**
 * Parses an Accept-Language header into tags, most preferred first.
 *
 * @param header Header value, or null when the request carried none.
 * @returns Language tags such as `['de-AT', 'de', 'en']`.
 */
export function preferredLanguages(header: string | null): readonly string[] {
  if (header === null || header.trim() === '') return [];

  return header
    .split(',')
    .map((part) => {
      const [tag = '', ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => /^\s*q=([\d.]+)\s*$/.exec(parameter))
        .find((match) => match !== null);

      return { tag: tag.trim(), quality: quality === undefined ? 1 : Number(quality[1]) };
    })
    .filter((entry) => entry.tag !== '' && entry.tag !== '*' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
}
