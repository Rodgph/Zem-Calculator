export const MARKETS = [
  { key: 'shopee', name: 'Shopee' },
  { key: 'tiktok', name: 'TikTok Shop' },
  { key: 'ml', name: 'Mercado Livre' },
  { key: 'kwai', name: 'Kwai' },
  { key: 'temu', name: 'Temu' },
  { key: 'shein', name: 'Shein' },
];

export const PRICE_COLUMN_MARKETS = MARKETS.filter(market => market.key !== 'shopee');

export const DEFAULT_FEES = {
  tiktok: { com: 6, fix: 0, imp: 0 },
  shopee: { com: 20, fix: 4, imp: 0 },
  ml: { com: 14, fix: 6, imp: 0 },
};

export const DEFAULT_MARGIN = 20;

export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value == null) return null;

  let text = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!text) return null;

  if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function marginAtPrice(product, price, fee) {
  if (price <= 0) return Number.NaN;
  return (1 - (fee.com + fee.imp) / 100 - (product.custo + fee.fix) / price) * 100;
}

export function calculateProduct(product, market, fees) {
  const fee = fees[market] || DEFAULT_FEES[market];
  if (!fee || !Number.isFinite(fee.com) || !Number.isFinite(fee.fix) || !Number.isFinite(fee.imp)) {
    return { price: Number.NaN, profit: Number.NaN, margin: Number.NaN };
  }

  if (market === 'shopee' && product.shopee != null) {
    const profit = product.shopee * (1 - (fee.com + fee.imp) / 100) - fee.fix - product.custo;
    return {
      price: product.shopee,
      profit,
      margin: product.shopee > 0 ? (profit / product.shopee) * 100 : Number.NaN,
    };
  }

  const margin = (product.margens?.[market] ?? DEFAULT_MARGIN) / 100;
  const divisor = 1 - fee.com / 100 - fee.imp / 100 - margin;
  if (divisor <= 0) return { price: Number.NaN, profit: Number.NaN, margin: Number.NaN };

  const price = (product.custo + fee.fix) / divisor;
  return { price, profit: price * margin, margin: margin * 100 };
}

export function formatCurrency(value) {
  return Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '—';
}
