import { parseAmount } from './pricing.js';

const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_PRODUCTS = 5000;
let xlsxModule;
let jszipModule;

function headerKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function findSpreadsheetColumns(header, aliases) {
  const normalizedAliases = Object.fromEntries(
    Object.entries(aliases).map(([key, values]) => [key, new Set(values.map(headerKey))]),
  );
  return Object.fromEntries(
    Object.keys(aliases).map(key => [
      key,
      header.findIndex(value => normalizedAliases[key].has(headerKey(value))),
    ]),
  );
}

function dispImgId(cell) {
  const formula = String(cell?.f || cell?.v || '');
  const match = formula.match(/DISPIMG\(\s*["']([^"']+)["']/i);
  return match?.[1] || null;
}

function normalizeZipPath(path) {
  const parts = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function imageMimeType(path) {
  const extension = path.split('.').pop().toLowerCase();
  return {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
  }[extension] || '';
}

async function loadEmbeddedImageLoaders(file, imageIds) {
  if (!imageIds.length) return new Map();
  if (!jszipModule) jszipModule = import('jszip');
  const JSZip = (await jszipModule).default;
  const archive = await JSZip.loadAsync(file);
  const imageXmlFile = archive.file('xl/cellimages.xml');
  const relationshipsFile = archive.file('xl/_rels/cellimages.xml.rels');
  if (!imageXmlFile || !relationshipsFile) {
    throw new Error('A planilha contém fórmulas de imagem, mas não encontrei os arquivos das imagens embutidas.');
  }

  const [imageXml, relationshipsXml] = await Promise.all([
    imageXmlFile.async('string'),
    relationshipsFile.async('string'),
  ]);
  const parser = new DOMParser();
  const imageDocument = parser.parseFromString(imageXml, 'application/xml');
  const relationshipsDocument = parser.parseFromString(relationshipsXml, 'application/xml');
  if (imageDocument.querySelector('parsererror') || relationshipsDocument.querySelector('parsererror')) {
    throw new Error('Não consegui ler as imagens embutidas da planilha.');
  }

  const relationshipTargets = new Map();
  for (const relationship of relationshipsDocument.getElementsByTagNameNS('*', 'Relationship')) {
    relationshipTargets.set(relationship.getAttribute('Id'), relationship.getAttribute('Target'));
  }

  const pathsById = new Map();
  for (const cellImage of imageDocument.getElementsByTagNameNS('*', 'cellImage')) {
    const picture = cellImage.getElementsByTagNameNS('*', 'cNvPr')[0];
    const blip = cellImage.getElementsByTagNameNS('*', 'blip')[0];
    const id = picture?.getAttribute('name');
    const relationId = blip?.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'embed',
    );
    const target = relationId && relationshipTargets.get(relationId);
    if (id && target) {
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      pathsById.set(id, normalizeZipPath(path));
    }
  }

  const loaders = new Map();
  for (const id of new Set(imageIds)) {
    const path = pathsById.get(id);
    const imageFile = path && archive.file(path);
    const mimeType = path && imageMimeType(path);
    if (!imageFile || !mimeType) throw new Error(`Não encontrei o arquivo da imagem embutida ${id}.`);

    loaders.set(id, async () => {
      const blob = await imageFile.async('blob');
      return new File([blob], `imagem.${path.split('.').pop()}`, { type: mimeType });
    });
  }
  return loaders;
}

export async function readContainerFile(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('O arquivo deve ter no máximo 100 MB.');
  if (!xlsxModule) xlsxModule = await import(/* @vite-ignore */ XLSX_URL);

  const XLSX = xlsxModule;
  const fileBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(fileBuffer, { type: 'array', sheetRows: 10000 });
  const aliases = {
    sku: ['sku', '货号', 'codigo'],
    nome: ['nome', 'name', '品名', 'produto', 'product'],
    descricao: [
      'descricao',
      'descrição',
      'descricao das mercadorias',
      'descrição das mercadorias',
      '货物描述',
      'description',
      'goods description',
      'descr',
      'obs',
      'observação',
      'observacao',
    ],
    custo: ['custo', 'cost'],
    shopee: ['shopee', 'preco', 'valor de venda', 'selling price'],
    image: [
      'imagem', 'image', 'foto', '图片', '商品图片', 'product image',
      'url', 'url imagem', 'url da imagem', 'imagem url', 'image url', 'image_url',
    ],
    image_secondary: [
      '装柜图片', 'imagem de embalagem', 'imagem secundária', 'secondary image',
      'container image', 'packing image',
    ],
  };
  const requiredColumns = ['sku', 'nome', 'custo', 'shopee'];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.['!ref']) continue;

    const bounds = XLSX.utils.decode_range(sheet['!ref']);
    const lastColumn = Math.min(bounds.e.c, 39);
    const preview = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      range: {
        s: { r: bounds.s.r, c: 0 },
        e: { r: Math.min(bounds.e.r, bounds.s.r + 19), c: lastColumn },
      },
      raw: true,
      defval: null,
    });
    const headerRow = preview.findIndex(row => {
      const columns = findSpreadsheetColumns(row, aliases);
      return requiredColumns.every(key => columns[key] >= 0);
    });
    if (headerRow < 0) continue;

    const header = preview[headerRow];
    const columns = findSpreadsheetColumns(header, aliases);
    const firstDataRow = bounds.s.r + headerRow + 1;
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      range: {
        s: { r: firstDataRow, c: 0 },
        e: { r: Math.min(bounds.e.r, firstDataRow + 9999), c: lastColumn },
      },
      raw: true,
      defval: null,
      blankrows: true,
    });
    const products = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const sku = String(row[columns.sku] || '').trim();
      const nome = String(row[columns.nome] || '').trim();
      const descricao = columns.descricao >= 0 ? String(row[columns.descricao] || '').trim() : '';
      const custo = parseAmount(row[columns.custo]);
      const rawPrice = parseAmount(row[columns.shopee]);
      if (!sku || custo == null || custo <= 0) continue;

      const sourceRow = firstDataRow + rowIndex;
      const readImage = column => {
        const cell = column >= 0
          ? sheet[XLSX.utils.encode_cell({ r: sourceRow, c: column })]
          : null;
        const imageId = dispImgId(cell);
        const imageValue = column >= 0 ? String(row[column] || '').trim() : '';
        const imageUrlCandidate = cell?.l?.Target || imageValue;
        return {
          imageId,
          imageUrl: /^(https?:\/\/|\/\/|data:image\/)/i.test(imageUrlCandidate)
            ? imageUrlCandidate
            : null,
        };
      };
      const image = readImage(columns.image);
      const secondaryImage = readImage(columns.image_secondary);
      products.push({
        sku,
        nome: nome || sku,
        descricao,
        custo,
        shopee: rawPrice > 0 ? rawPrice : null,
        imageUrl: image.imageUrl,
        imageId: image.imageId,
        imageUrlSecondary: secondaryImage.imageUrl,
        imageIdSecondary: secondaryImage.imageId,
      });
    }

    if (!products.length) {
      throw new Error('Encontrei as colunas, mas não encontrei produtos com SKU e custo válido.');
    }
    if (products.length > MAX_PRODUCTS) {
      throw new Error(`O limite por contêiner é de ${MAX_PRODUCTS.toLocaleString('pt-BR')} produtos.`);
    }

    const imageLoaders = await loadEmbeddedImageLoaders(
      fileBuffer,
      products.flatMap(product => [product.imageId, product.imageIdSecondary]).filter(Boolean),
    );
    return products.map(({ imageId, imageIdSecondary, ...product }) => ({
      ...product,
      loadImage: imageId ? imageLoaders.get(imageId) : null,
      loadImageSecondary: imageIdSecondary ? imageLoaders.get(imageIdSecondary) : null,
    }));
  }

  throw new Error('Não encontrei as colunas SKU/货号, nome/品名, custo e Shopee na planilha.');
}
