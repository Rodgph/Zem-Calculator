import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ImageViewer from '../components/ImageViewer.jsx';
import KitFormDialog from '../components/KitFormDialog.jsx';
import MarketplaceFeesDialog from '../components/MarketplaceFeesDialog.jsx';
import ProductFormDialog from '../components/ProductFormDialog.jsx';
import { supabase } from '../lib/supabase.js';
import {
  DEFAULT_FEES,
  DEFAULT_MARGIN,
  MARKETS,
  PRICE_COLUMN_MARKETS,
  calculateProduct,
  formatCurrency,
  parseAmount,
} from '../lib/pricing.js';
import { publicImageUrl, removeImages, uploadImage } from '../lib/images.js';
import { compareProductsByCode, matchesSkuPrefix } from '../lib/sku.js';

const PAGE_SIZE = 500;
const MARKET_BY_KEY = Object.fromEntries(MARKETS.map(market => [market.key, market]));
const VISIBLE_MARKETS_STORAGE_KEY = 'visible-marketplace-price-columns';
const DEFAULT_VISIBLE_MARKETS = ['ml'];

function readVisibleMarkets() {
  try {
    const saved = window.localStorage.getItem(VISIBLE_MARKETS_STORAGE_KEY);
    if (!saved) return DEFAULT_VISIBLE_MARKETS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_MARKETS;
    return [...new Set(parsed.filter(key => PRICE_COLUMN_MARKETS.some(market => market.key === key)))];
  } catch {
    return DEFAULT_VISIBLE_MARKETS;
  }
}

function formatAmountInput(value) {
  if (value == null || value === '') return '';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
}

function formatPercentInput(value) {
  return Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : '';
}

function ProductRow({
  product,
  margin,
  fees,
  visibleMarkets,
  isKit = false,
  displayImagePath,
  onSavePrice,
  onSaveField,
  onSaveMargin,
  onNotice,
  onDelete,
  onViewImage,
  onAddKit,
  allowAddKit = false,
}) {
  const [priceDraft, setPriceDraft] = useState(formatAmountInput(product.shopee));
  const [priceDirty, setPriceDirty] = useState(false);
  const [skuDraft, setSkuDraft] = useState(product.sku ?? '');
  const [nameDraft, setNameDraft] = useState(product.nome ?? '');
  const [costDraft, setCostDraft] = useState(formatAmountInput(product.custo));
  const [costDirty, setCostDirty] = useState(false);
  const calculations = useMemo(() => {
    const marginKeys = new Set([...Object.keys(product.margens || {}), ...Object.keys(fees)]);
    const adjusted = {
      ...product,
      margens: Object.fromEntries([...marginKeys].map(key => [key, margin])),
    };
    return {
      shopee: calculateProduct(adjusted, 'shopee', fees),
      marketplaces: Object.fromEntries(visibleMarkets.map(key => [
        key,
        calculateProduct(adjusted, key, fees),
      ])),
    };
  }, [fees, margin, product, visibleMarkets]);
  const [percentDraft, setPercentDraft] = useState(formatPercentInput(calculations.shopee.margin));
  const [percentDirty, setPercentDirty] = useState(false);

  useEffect(() => {
    setPriceDraft(formatAmountInput(product.shopee));
    setPriceDirty(false);
  }, [product.shopee]);
  useEffect(() => setSkuDraft(product.sku ?? ''), [product.sku]);
  useEffect(() => setNameDraft(product.nome ?? ''), [product.nome]);
  useEffect(() => {
    setCostDraft(formatAmountInput(product.custo));
    setCostDirty(false);
  }, [product.custo]);
  useEffect(() => {
    if (!percentDirty) setPercentDraft(formatPercentInput(calculations.shopee.margin));
  }, [calculations.shopee.margin, percentDirty]);

  async function saveSku() {
    const sku = skuDraft.trim();
    if (!sku || sku === product.sku) {
      if (!sku) setSkuDraft(product.sku ?? '');
      return;
    }
    if (!await onSaveField(product, 'sku', sku)) setSkuDraft(product.sku ?? '');
  }

  async function saveName() {
    const name = nameDraft.trim();
    if (!name || name === product.nome) {
      if (!name) setNameDraft(product.nome ?? '');
      return;
    }
    if (!await onSaveField(product, 'nome', name)) setNameDraft(product.nome ?? '');
  }

  async function saveCost() {
    if (!costDirty) return;
    const cost = parseAmount(costDraft);
    if (cost == null || cost <= 0) {
      setCostDraft(formatAmountInput(product.custo));
      setCostDirty(false);
      return;
    }
    setCostDirty(false);
    if (cost !== Number(product.custo) && !await onSaveField(product, 'custo', cost)) {
      setCostDraft(formatAmountInput(product.custo));
    }
  }

  async function savePercent() {
    if (!percentDirty) return;
    const percent = parseAmount(percentDraft);
    const maxPercent = 100 - fees.shopee.com - fees.shopee.imp;
    if (percent == null || percent < 0 || percent >= maxPercent) {
      setPercentDraft(formatPercentInput(calculations.shopee.margin));
      setPercentDirty(false);
      onNotice(`Informe uma porcentagem de 0% até menos de ${maxPercent}%.`, 'error');
      return;
    }

    setPercentDirty(false);
    const saved = await onSaveMargin(product, percent);
    if (!saved) setPercentDraft(formatPercentInput(calculations.shopee.margin));
  }

  async function savePrice() {
    if (!priceDirty) return;
    setPriceDirty(false);
    if (priceDraft === '' || priceDraft == null) {
      if (product.shopee != null && !await onSavePrice(product, null)) {
        setPriceDraft(formatAmountInput(product.shopee));
      }
      return;
    }
    const price = parseAmount(priceDraft);
    if (price == null || price <= 0) {
      setPriceDraft(formatAmountInput(product.shopee));
      return;
    }
    if (price !== Number(product.shopee) && !await onSavePrice(product, price)) {
      setPriceDraft(formatAmountInput(product.shopee));
    }
  }

  return (
    <tr className={isKit ? 'kit-row' : undefined}>
      <td className="product-name-cell">
        <div className={`product-ident${isKit ? ' kit-ident' : ''}`}>
          {isKit && <span className="kit-branch" aria-hidden="true">↳</span>}
          {(displayImagePath || product.img_path) ? (
            <button
              className="image-preview-button"
              type="button"
              onClick={() => onViewImage(publicImageUrl(displayImagePath || product.img_path), product.nome || product.sku)}
              aria-label={`Ampliar imagem de ${product.nome || product.sku}`}
            >
              <img className="product-thumb" src={publicImageUrl(displayImagePath || product.img_path)} alt="" />
            </button>
          ) : (
            <span className="product-thumb placeholder-thumb" aria-hidden="true">Z</span>
          )}
          <span>
            {isKit ? (
              <>
                <input
                  className="editable-product-name"
                  value={nameDraft}
                  onChange={event => setNameDraft(event.target.value)}
                  onBlur={saveName}
                  onKeyDown={event => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  aria-label={`Nome do kit ${product.sku}`}
                />
                <small className="kit-quantity">{product.kit_quantity} unidades no kit</small>
              </>
            ) : (
              <strong>{product.nome || 'Produto sem nome'}</strong>
            )}
            <small className="editable-sku">
              SKU:
              <input
                value={skuDraft}
                onChange={event => setSkuDraft(event.target.value)}
                onBlur={saveSku}
                onKeyDown={event => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
                aria-label={`SKU do produto ${product.nome || product.sku}`}
              />
            </small>
          </span>
        </div>
      </td>
      <td>
        <label className="price-input cost-input">
          <span className="visually-hidden">Custo de {product.sku}</span>
          <span>R$</span>
          <input
            inputMode="decimal"
            value={costDraft}
            onChange={event => {
              setCostDraft(event.target.value);
              setCostDirty(true);
            }}
            onBlur={saveCost}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label={`Custo do produto ${product.sku}`}
          />
        </label>
      </td>
      <td>
        <label className="price-input">
          <span className="visually-hidden">Preço de venda Shopee para {product.sku}</span>
          <span>R$</span>
          <input
            inputMode="decimal"
            value={priceDraft}
            placeholder={formatCurrency(calculations.shopee.price).replace('R$', '').trim()}
            onChange={event => {
              setPriceDraft(event.target.value);
              setPriceDirty(true);
            }}
            onBlur={savePrice}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label={`Preço Shopee para ${product.sku}`}
          />
        </label>
      </td>
      <td className="result-cell">
        <strong>{formatCurrency(calculations.shopee.profit)}</strong>
        <label className="editable-percent">
          <input
            inputMode="decimal"
            value={percentDraft}
            onChange={event => {
              setPercentDraft(event.target.value);
              setPercentDirty(true);
            }}
            onBlur={savePercent}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label={`Margem Shopee do produto ${product.sku}`}
          />
          <span>%</span>
        </label>
      </td>
      {visibleMarkets.map(market => {
        const calculation = calculations.marketplaces[market];
        const configured = Boolean(fees[market]);
        return (
          <td key={market}>
            <strong>{formatCurrency(calculation.price)}</strong>
            <small className={configured ? undefined : 'muted'}>
              {configured ? `${formatCurrency(calculation.profit)} lucro` : 'Configure as taxas'}
            </small>
          </td>
        );
      })}
      <td>
        {allowAddKit && !isKit && (
          <button className="icon-button add-kit-button" type="button" onClick={() => onAddKit(product)} aria-label={`Criar kit de ${product.nome || product.sku}`}>
            +
          </button>
        )}
        <button className="icon-button danger-text" type="button" onClick={() => onDelete(product)} aria-label={`Apagar produto ${product.sku}`}>
          ×
        </button>
      </td>
    </tr>
  );
}

export default function ContainerPage({
  containers,
  loadingContainers,
  onContainersChanged,
  onNotice,
  containerId,
  productScope,
  filtersToolbar,
  embedded = false,
  skuPrefix = '',
  codeOrder = 'asc',
  addProductOpen,
  onAddProductOpenChange,
}) {
  const routeParams = useParams();
  const id = containerId !== undefined ? containerId : routeParams.id || null;
  const scope = productScope || (id ? 'container' : 'all');
  const navigate = useNavigate();
  const container = id ? containers.find(item => String(item.id) === String(id)) : null;
  const PageRoot = embedded ? 'section' : 'main';
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [pageError, setPageError] = useState('');
  const [filter, setFilter] = useState('');
  const [margin, setMargin] = useState(DEFAULT_MARGIN);
  const [marginInput, setMarginInput] = useState(String(DEFAULT_MARGIN));
  const [addBusy, setAddBusy] = useState(false);
  const [productToKit, setProductToKit] = useState(null);
  const [kitBusy, setKitBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [productDeleteBusy, setProductDeleteBusy] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [marketFees, setMarketFees] = useState(DEFAULT_FEES);
  const [feesDialogOpen, setFeesDialogOpen] = useState(false);
  const [feesBusy, setFeesBusy] = useState(false);
  const [feesError, setFeesError] = useState('');
  const [visibleMarkets, setVisibleMarkets] = useState(readVisibleMarkets);
  const [marketToAdd, setMarketToAdd] = useState('');

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setPageError('');
    try {
      const allProducts = [];
      let offset = 0;
      while (true) {
        let query = supabase.from('products').select('*');
        if (scope === 'container') query = query.eq('container_id', id);
        if (scope === 'unassigned') query = query.is('container_id', null);
        const { data, error } = await query
          .order('sku', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (error) throw new Error(error.message);
        allProducts.push(...(data || []));
        if (!data || data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      setProducts(allProducts);
    } catch (error) {
      setPageError(`Erro ao carregar produtos: ${error.message || String(error)}`);
    } finally {
      setLoadingProducts(false);
    }
  }, [id, scope]);

  useEffect(() => {
    if (scope !== 'container' || container) loadProducts();
  }, [container, loadProducts, scope]);

  useEffect(() => {
    const savedMargin = Number(window.localStorage.getItem(`container-margin-${id || scope}`));
    const nextMargin = Number.isFinite(savedMargin) && savedMargin > 0 && savedMargin < 100
      ? savedMargin
      : DEFAULT_MARGIN;
    setMargin(nextMargin);
    setMarginInput(String(nextMargin));
  }, [id, scope]);

  useEffect(() => {
    window.localStorage.setItem(VISIBLE_MARKETS_STORAGE_KEY, JSON.stringify(visibleMarkets));
  }, [visibleMarkets]);

  useEffect(() => {
    let active = true;
    async function loadMarketplaceFees() {
      try {
        const { data, error } = await supabase
          .from('fees')
          .select('marketplace,com,fix,imp');
        if (error) throw new Error(error.message);
        if (!active) return;

        const loadedFees = { ...DEFAULT_FEES };
        (data || []).forEach(row => {
          const fee = { com: Number(row.com), fix: Number(row.fix), imp: Number(row.imp) };
          if (Number.isFinite(fee.com) && Number.isFinite(fee.fix) && Number.isFinite(fee.imp)) {
            loadedFees[row.marketplace] = fee;
          }
        });
        setMarketFees(loadedFees);
        setFeesError('');
      } catch (error) {
        if (!active) return;
        setFeesError(`Não foi possível carregar as taxas salvas: ${error.message || String(error)}`);
      }
    }

    loadMarketplaceFees();
    return () => {
      active = false;
    };
  }, []);

  const productGroups = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase('pt-BR');
    const matches = product =>
      `${product.nome || ''} ${product.sku || ''}`.toLocaleLowerCase('pt-BR').includes(query)
      && matchesSkuPrefix(product.sku, skuPrefix);
    const direction = codeOrder === 'desc' ? -1 : 1;
    const sortedProducts = [...products].sort((left, right) => compareProductsByCode(left, right, direction));
    if (scope !== 'container') {
      return sortedProducts
        .filter(matches)
        .map(product => ({ product, kits: [], productMatches: true, visible: true }));
    }

    const productIds = new Set(sortedProducts.map(product => String(product.id)));
    const kitsByParent = new Map();
    sortedProducts.forEach(product => {
      if (!product.parent_product_id || !productIds.has(String(product.parent_product_id))) return;
      const parentId = String(product.parent_product_id);
      const kits = kitsByParent.get(parentId) || [];
      kits.push(product);
      kitsByParent.set(parentId, kits);
    });
    return sortedProducts
      .filter(product => !product.parent_product_id)
      .map(product => {
        const kits = kitsByParent.get(String(product.id)) || [];
        const matchingKits = kits.filter(matches);
        const productMatches = matches(product);
        return {
          product,
          kits: matchingKits,
          productMatches,
          visible: productMatches || matchingKits.length > 0,
        };
      })
      .filter(group => group.visible);
  }, [codeOrder, filter, products, scope, skuPrefix]);
  const productCount = products.filter(product => !product.parent_product_id).length;
  const kitCount = products.length - productCount;

  async function savePrice(product, price) {
    const { error } = await supabase.from('products').update({ shopee: price }).eq('id', product.id);
    if (error) {
      onNotice(`Não foi possível salvar o preço: ${error.message}`, 'error');
      return false;
    }
    setProducts(current => current.map(item => item.id === product.id ? { ...item, shopee: price } : item));
    return true;
  }

  async function saveProductField(product, field, value) {
    const { error } = await supabase.from('products').update({ [field]: value }).eq('id', product.id);
    if (error) {
      const fieldName = { nome: 'o nome', sku: 'o SKU', custo: 'o custo' }[field] || field;
      onNotice(`Não foi possível salvar ${fieldName}: ${error.message}`, 'error');
      return false;
    }
    setProducts(current => current
      .map(item => item.id === product.id ? { ...item, [field]: value } : item)
      .sort((a, b) => String(a.sku).localeCompare(String(b.sku))));
    onNotice(`${{ nome: 'Nome', sku: 'SKU', custo: 'Custo' }[field] || field} atualizado.`);
    return true;
  }

  async function saveProductMargin(product, percent) {
    const simulated = calculateProduct({
      ...product,
      shopee: null,
      margens: { ...product.margens, shopee: percent },
    }, 'shopee', marketFees);
    if (!Number.isFinite(simulated.price)) {
      onNotice('Não foi possível calcular um preço para essa porcentagem.', 'error');
      return false;
    }

    const margens = { ...product.margens, shopee: percent };
    const { error } = await supabase
      .from('products')
      .update({ shopee: simulated.price, margens })
      .eq('id', product.id);
    if (error) {
      onNotice(`Não foi possível salvar a porcentagem: ${error.message}`, 'error');
      return false;
    }

    setProducts(current => current.map(item => item.id === product.id
      ? { ...item, shopee: simulated.price, margens }
      : item));
    onNotice('Porcentagem e preço Shopee atualizados.');
    return true;
  }

  async function saveMarketplaceFees(records) {
    setFeesBusy(true);
    try {
      const { error } = await supabase
        .from('fees')
        .upsert(records, { onConflict: 'marketplace' });
      if (error) throw new Error(error.message);

      setMarketFees(current => ({
        ...current,
        ...Object.fromEntries(records.map(record => [
          record.marketplace,
          { com: record.com, fix: record.fix, imp: record.imp },
        ])),
      }));
      setFeesError('');
      onNotice('Taxas dos marketplaces atualizadas.');
      return true;
    } catch (error) {
      onNotice(`Não foi possível salvar as taxas: ${error.message || String(error)}`, 'error');
      return false;
    } finally {
      setFeesBusy(false);
    }
  }

  function addMarketplace(event) {
    const market = event.target.value;
    if (!market) return;
    setVisibleMarkets(current => current.includes(market) ? current : [...current, market]);
    setMarketToAdd('');
  }

  function hideMarketplace(market) {
    setVisibleMarkets(current => current.filter(key => key !== market));
  }

  async function saveNewProduct(values) {
    setAddBusy(true);
    try {
      let imagePath = null;
      if (values.imageBlob) imagePath = await uploadImage(values.imageBlob);
      const { data, error } = await supabase
        .from('products')
        .insert({
          container_id: id,
          nome: values.nome,
          sku: values.sku,
          custo: values.custo,
          shopee: null,
          img_path: imagePath,
          margens: { tiktok: DEFAULT_MARGIN, shopee: DEFAULT_MARGIN, ml: DEFAULT_MARGIN },
        })
        .select()
        .single();
      if (error) {
        if (imagePath) {
          const failures = await removeImages([imagePath]);
          if (failures.length) throw new Error(`Não foi possível salvar o produto: ${error.message}. Falha ao remover imagem: ${failures.join('; ')}`);
        }
        throw new Error(`Não foi possível salvar o produto: ${error.message}`);
      }
      setProducts(current => [...current, data].sort((a, b) => String(a.sku).localeCompare(String(b.sku))));
      onNotice('Produto adicionado.');
      return true;
    } catch (error) {
      onNotice(error.message || String(error), 'error');
      return false;
    } finally {
      setAddBusy(false);
    }
  }

  async function saveNewKit(product, values) {
    setKitBusy(true);
    try {
      const productMargin = product.shopee == null
        ? margin
        : calculateProduct(product, 'shopee', marketFees).margin;
      const margens = {
        tiktok: margin,
        shopee: productMargin,
        ml: margin,
      };
      const shopee = calculateProduct({
        custo: values.custo,
        shopee: null,
        margens,
      }, 'shopee', marketFees);
      if (!Number.isFinite(shopee.price)) {
        throw new Error('Não foi possível calcular o preço Shopee para este kit.');
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          container_id: id,
          parent_product_id: product.id,
          kit_quantity: values.kitQuantity,
          nome: values.nome,
          sku: values.sku,
          custo: values.custo,
          shopee: shopee.price,
          img_path: null,
          margens,
        })
        .select()
        .single();
      if (error) throw new Error(`Não foi possível criar o kit: ${error.message}`);

      setProducts(current => [...current, data]);
      setProductToKit(null);
      onNotice(`Kit criado. O preço Shopee foi calculado com margem de ${productMargin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%.`);
      return true;
    } catch (error) {
      onNotice(error.message || String(error), 'error');
      return false;
    } finally {
      setKitBusy(false);
    }
  }

  async function deleteProduct() {
    const product = productToDelete;
    if (!product) return;
    setProductDeleteBusy(true);
    const removedProducts = products.filter(item =>
      item.id === product.id || String(item.parent_product_id) === String(product.id));
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) {
      onNotice(`Não foi possível apagar o produto: ${error.message}`, 'error');
      setProductDeleteBusy(false);
      return;
    }
    setProducts(current => current.filter(item => !removedProducts.some(removed => removed.id === item.id)));
    setProductToDelete(null);
    setProductDeleteBusy(false);
    const imagePaths = removedProducts.map(item => item.img_path).filter(Boolean);
    if (imagePaths.length) {
      const failures = await removeImages(imagePaths);
      if (failures.length) onNotice(`Produto apagado, mas não foi possível limpar a imagem: ${failures.join('; ')}`, 'error');
    }
  }

  async function deleteContainer() {
    setDeleteBusy(true);
    const { data: imageRows, error: imagesError } = await supabase
      .from('products')
      .select('img_path')
      .eq('container_id', id);
    if (imagesError) {
      setDeleteBusy(false);
      onNotice(`Não foi possível listar as imagens do contêiner: ${imagesError.message}`, 'error');
      return;
    }

    const { error } = await supabase.from('containers').delete().eq('id', id);
    if (error) {
      setDeleteBusy(false);
      onNotice(`Não foi possível apagar o contêiner: ${error.message}`, 'error');
      return;
    }

    const failures = await removeImages((imageRows || []).map(row => row.img_path));
    setDeleteBusy(false);
    setDeleteOpen(false);
    await onContainersChanged();
    navigate('/produtos');
    if (failures.length) {
      onNotice(`Contêiner apagado, mas algumas imagens não puderam ser removidas: ${failures.join('; ')}`, 'error');
    } else {
      onNotice('Contêiner e produtos associados apagados.');
    }
  }

  function commitMargin() {
    const parsed = Number(marginInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 100) {
      setMarginInput(String(margin));
      return;
    }
    setMargin(parsed);
    window.localStorage.setItem(`container-margin-${id || scope}`, String(parsed));
  }

  if (scope === 'container' && loadingContainers) {
    return <PageRoot className="empty-state">Carregando contêiner…</PageRoot>;
  }
  if (scope === 'container' && !container) {
    return (
      <PageRoot className="empty-card">
        <h1>Contêiner não encontrado</h1>
        <p className="muted">Ele pode ter sido apagado ou o endereço está incorreto.</p>
        <Link className="btn" to="/produtos">Voltar aos produtos</Link>
      </PageRoot>
    );
  }

  return (
    <PageRoot className={embedded ? 'container-products-view' : undefined}>
      {!embedded && scope === 'container' && (
        <div className="breadcrumb"><Link to="/produtos">Produtos</Link><span>/</span><strong>{container.nome}</strong></div>
      )}
      <section className="page-heading detail-heading">
        <div>
          <p className="eyebrow">{scope === 'container' ? 'Contêiner' : 'Catálogo da empresa'}</p>
          <h1>
            {scope === 'container'
              ? container.nome
              : scope === 'unassigned' ? 'Sem contêiner' : 'Produtos'}
          </h1>
          <p className="muted">
            {scope === 'container'
              ? `${productCount} ${productCount === 1 ? 'produto' : 'produtos'}${kitCount > 0 ? ` · ${kitCount} ${kitCount === 1 ? 'kit' : 'kits'}` : ''}`
              : `${products.length} ${products.length === 1 ? 'produto cadastrado' : 'produtos cadastrados'}`}
          </p>
        </div>
        <div className="heading-actions">
          {scope === 'container' && (
            <button className="btn danger" type="button" onClick={() => setDeleteOpen(true)}>Apagar contêiner</button>
          )}
        </div>
      </section>

      {filtersToolbar}

      <section className="calculator-toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input
            value={filter}
            onChange={event => setFilter(event.target.value)}
            placeholder="Buscar por nome ou SKU"
            aria-label="Buscar produtos"
          />
        </label>
        <label className="margin-control">
          Margem alvo
          <span className="margin-input">
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              value={marginInput}
              onChange={event => setMarginInput(event.target.value)}
              onBlur={commitMargin}
              onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              aria-label="Margem de lucro alvo"
            />
            %
          </span>
        </label>
        <label className="marketplace-select">
          <span className="visually-hidden">Adicionar marketplace à tabela</span>
          <select
            value={marketToAdd}
            onChange={addMarketplace}
            aria-label="Adicionar marketplace"
          >
            <option value="">+ Marketplace</option>
            {PRICE_COLUMN_MARKETS
              .filter(market => !visibleMarkets.includes(market.key))
              .map(market => (
                <option key={market.key} value={market.key}>{market.name}</option>
              ))}
          </select>
        </label>
        <button
          className="btn ghost fees-settings-button"
          type="button"
          onClick={() => setFeesDialogOpen(true)}
        >
          Configurar taxas
        </button>
        <span className="fees-note">Preços calculados pela margem alvo e pelas taxas configuradas.</span>
      </section>

      {feesError && <p className="error-message" role="alert">{feesError}</p>}
      {pageError ? (
        <section className="empty-card" role="alert">
          <h2>Falha ao carregar produtos</h2>
          <p className="muted">{pageError}</p>
          <button className="btn" type="button" onClick={loadProducts}>Tentar novamente</button>
        </section>
      ) : loadingProducts ? (
        <p className="empty-state">Carregando produtos…</p>
      ) : products.length === 0 ? (
        <section className="empty-card">
          <h2>{scope === 'container' ? 'Este contêiner ainda não tem produtos' : 'Nenhum produto encontrado'}</h2>
          <p className="muted">
            {scope === 'container'
              ? 'Use “Adicionar produto” na barra superior ou importe um contêiner para começar.'
              : 'Use “Adicionar produto” na barra superior ou altere os filtros para visualizar o catálogo.'}
          </p>
        </section>
      ) : productGroups.length === 0 ? (
        <p className="empty-state">Nenhum produto encontrado para os filtros selecionados.</p>
      ) : (
        <div className="table-scroll">
          <table className="products-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Custo</th>
                <th>Venda Shopee</th>
                <th>Lucro Shopee</th>
                {visibleMarkets.map(market => (
                  <th className="marketplace-heading" key={market}>
                    <span>Preço {MARKET_BY_KEY[market].name}</span>
                    <button
                      className="hide-marketplace-button"
                      type="button"
                      onClick={() => hideMarketplace(market)}
                      aria-label={`Ocultar preços de ${MARKET_BY_KEY[market].name}`}
                      title={`Ocultar ${MARKET_BY_KEY[market].name}`}
                    >
                      ×
                    </button>
                  </th>
                ))}
                <th><span className="visually-hidden">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {productGroups.map(({ product, kits }) => (
                <Fragment key={product.id}>
                  <ProductRow
                    product={product}
                    margin={margin}
                    fees={marketFees}
                    visibleMarkets={visibleMarkets}
                    allowAddKit={scope === 'container'}
                    onSavePrice={savePrice}
                    onSaveField={saveProductField}
                    onSaveMargin={saveProductMargin}
                    onNotice={onNotice}
                    onDelete={setProductToDelete}
                    onViewImage={(src, alt) => setViewingImage({ src, alt })}
                    onAddKit={setProductToKit}
                  />
                  {kits.map(kit => (
                    <ProductRow
                      key={kit.id}
                      product={kit}
                      margin={margin}
                      fees={marketFees}
                      visibleMarkets={visibleMarkets}
                      isKit
                      displayImagePath={product.img_path}
                      onSavePrice={savePrice}
                      onSaveField={saveProductField}
                      onSaveMargin={saveProductMargin}
                      onNotice={onNotice}
                      onDelete={setProductToDelete}
                      onViewImage={(src, alt) => setViewingImage({ src, alt })}
                    />
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addProductOpen && (
        <ProductFormDialog
          busy={addBusy}
          onClose={() => onAddProductOpenChange(false)}
          onSave={saveNewProduct}
        />
      )}
      {feesDialogOpen && (
        <MarketplaceFeesDialog
          fees={marketFees}
          busy={feesBusy}
          onClose={() => setFeesDialogOpen(false)}
          onSave={saveMarketplaceFees}
        />
      )}
      {viewingImage && (
        <ImageViewer
          src={viewingImage.src}
          alt={viewingImage.alt}
          onClose={() => setViewingImage(null)}
        />
      )}
      {productToKit && (
        <KitFormDialog
          product={productToKit}
          existingSkus={products.map(product => product.sku)}
          busy={kitBusy}
          onClose={() => setProductToKit(null)}
          onSave={values => saveNewKit(productToKit, values)}
        />
      )}
      {deleteOpen && (
        <ConfirmDialog
          title="Apagar contêiner?"
          message={`O contêiner “${container.nome}” e todos os seus ${products.length} produtos serão apagados.`}
          busy={deleteBusy}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={deleteContainer}
        />
      )}
      {productToDelete && (
        <ConfirmDialog
          title="Apagar produto?"
          message={productToDelete.parent_product_id
            ? `O kit “${productToDelete.nome || productToDelete.sku}” será removido do catálogo.`
            : `O produto “${productToDelete.nome || productToDelete.sku}”${products.some(item => String(item.parent_product_id) === String(productToDelete.id)) ? ' e seus kits' : ''} serão removidos do catálogo.`}
          busy={productDeleteBusy}
          onCancel={() => setProductToDelete(null)}
          onConfirm={deleteProduct}
          confirmLabel={productToDelete.parent_product_id ? 'Apagar kit' : 'Apagar produto'}
        />
      )}
    </PageRoot>
  );
}
