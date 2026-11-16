export const SKU_PREFIXES = ['WJ-', 'WL-', 'MJ-', 'TV-', 'ZEM-', 'ZH-'];

export function skuCode(sku) {
  const suffix = String(sku || '').trim().match(/^[^-]+-(\d+)/);
  return suffix ? Number(suffix[1]) : null;
}

export function matchesSkuPrefix(sku, prefix) {
  return !prefix || String(sku || '').trim().toLocaleUpperCase('pt-BR').startsWith(prefix);
}

export function compareProductsByCode(left, right, direction = 1) {
  const leftCode = skuCode(left.sku);
  const rightCode = skuCode(right.sku);
  if (leftCode !== null && rightCode !== null && leftCode !== rightCode) {
    return (leftCode - rightCode) * direction;
  }
  if (leftCode !== null && rightCode === null) return -1;
  if (leftCode === null && rightCode !== null) return 1;
  return String(left.sku || '').localeCompare(String(right.sku || ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  });
}
