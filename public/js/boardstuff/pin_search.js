export function selectPins(pins, query = '', order = 'newest') {
  const search = query.trim().toLowerCase();
  return pins.filter(pin => [pin.title, pin.description].some(value => String(value ?? '').toLowerCase().includes(search)))
    .sort((a, b) => {
      const tie = String(a.pin_id ?? '').localeCompare(String(b.pin_id ?? ''), 'en', { numeric: true });
      if (order === 'title') return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'en', { sensitivity: 'base' }) || tie;
      const left = a.created_at ? Date.parse(a.created_at) : NaN;
      const right = b.created_at ? Date.parse(b.created_at) : NaN;
      if (Number.isFinite(left) !== Number.isFinite(right)) return Number.isFinite(left) ? -1 : 1;
      const difference = Number.isFinite(left) ? left - right : 0;
      return (order === 'oldest' ? difference : -difference) || tie;
    });
}
