export function cellText(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map(part => part.text).join('').trim();
    if ('result' in value) return cellText(value.result);
    if ('text' in value) return String(value.text).trim();
    return '';
  }
  return String(value).trim();
}
export function extractTeams(rows, column, skipHeader, existing = []) {
  const names = rows.slice(skipHeader ? 1 : 0).map(row => cellText(row[column])).filter(Boolean);
  if (!names.length) throw Error('No team names found in this column.');
  if (names.some(n => n.length > 80)) throw Error('Team names must be 80 characters or fewer.');
  if (names.length + existing.length > 128) throw Error('A bracket can contain at most 128 teams.');
  const all = [...existing, ...names].map(n => n.toLowerCase());
  if (new Set(all).size !== all.length) throw Error('Duplicate team names found. Give each team a unique name or choose Replace existing teams.');
  return names;
}
