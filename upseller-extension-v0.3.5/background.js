// background.js - Service Worker MV3
// Recebe o anúncio gerado pelo site, abre o formulário do Upseller e preenche os campos.

const UPS_CREATE_URL = 'https://app.upseller.com/pt/products/shopee/create';
const PRODUCTION_SITE_ORIGINS = new Set([
  'https://zemcalculator.vercel.app',
  'https://calculadora-preco-eight.vercel.app',
]);

// Armazena payloads pendentes por tabId
const pendingPayloads = new Map();
const pendingExternalResponses = new Map();
const pendingPrepareResponses = new Map();
const readyTabs = new Set();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.remove('openaiApiKey', () => {
    if (chrome.runtime.lastError) {
      console.error('[Upseller Bridge] Não foi possível remover a chave local antiga:', chrome.runtime.lastError.message);
    }
  });
});

function isAllowedSiteSender(sender) {
  try {
    const url = new URL(sender.url);
    return PRODUCTION_SITE_ORIGINS.has(url.origin) ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

function dispatchPrepare(tabId) {
  const externalResponse = pendingPrepareResponses.get(tabId);
  if (!externalResponse) return;

  chrome.tabs.sendMessage(tabId, { type: 'PREPARE_FORM' }, (response) => {
    const currentResponse = pendingPrepareResponses.get(tabId);
    if (!currentResponse) return;
    pendingPrepareResponses.delete(tabId);

    if (chrome.runtime.lastError) {
      currentResponse({ ok: false, error: chrome.runtime.lastError.message, tabId });
      return;
    }
    currentResponse(response
      ? { ...response, tabId }
      : {
        ok: false,
        error: 'A extensão não confirmou a preparação do formulário.',
        tabId,
      });
  });
}

function dispatchFill(tabId, readyResponse) {
  const payload = pendingPayloads.get(tabId);
  if (!payload) {
    const result = { ok: false, error: 'Payload não encontrado para esta aba', tabId };
    if (readyResponse) readyResponse(result);
    const externalResponse = pendingExternalResponses.get(tabId);
    if (externalResponse) {
      pendingExternalResponses.delete(tabId);
      externalResponse(result);
    }
    return;
  }

  chrome.tabs.sendMessage(tabId, { type: 'FILL_FORM', payload }, (response) => {
    const result = chrome.runtime.lastError
      ? { ok: false, error: chrome.runtime.lastError.message, tabId }
      : { ...(response || { ok: false, error: 'A extensão não retornou o resultado do preenchimento.' }), tabId };
    if (readyResponse) readyResponse(result);
    const externalResponse = pendingExternalResponses.get(tabId);
    if (externalResponse) {
      pendingExternalResponses.delete(tabId);
      externalResponse(result);
    }
  });
}

// ==================== MESSAGE HANDLERS ====================

// Escuta mensagens do SEU SITE (via externally_connectable)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!isAllowedSiteSender(sender)) {
    sendResponse({ ok: false, error: 'Origem não autorizada.' });
    return false;
  }
  if (message?.type === 'OPEN_SHOPEE') {
    console.log('[Upseller Bridge] Abrindo formulário para preparação.');
    chrome.tabs.create({ url: UPS_CREATE_URL, active: true }, (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'Não foi possível abrir a aba do Upseller.' });
        return;
      }
      pendingPrepareResponses.set(tab.id, sendResponse);
      if (readyTabs.delete(tab.id)) dispatchPrepare(tab.id);
    });
    return true;
  }
  if (message?.type === 'UPDATE_PROGRESS') {
    const { tabId, text, status } = message;
    if (
      !Number.isInteger(tabId) ||
      typeof text !== 'string' ||
      !text.trim() ||
      text.length > 500 ||
      !['info', 'error'].includes(status)
    ) {
      sendResponse({ ok: false, error: 'Atualização de progresso inválida.' });
      return false;
    }
    chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_PROGRESS',
      text: text.trim(),
      status,
    }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse(response || { ok: false, error: 'A extensão não confirmou a atualização do progresso.' });
    });
    return true;
  }
  if ([
    'FILL_TITLE_CATEGORY',
    'FILL_DESCRIPTION',
    'FILL_MODEL_PRICE_SHIPPING',
    'FILL_IMAGES',
  ].includes(message?.type)) {
    if (!Number.isInteger(message.tabId) || message.tabId <= 0) {
      sendResponse({ ok: false, error: 'Aba do UpSeller inválida.' });
      return false;
    }
    chrome.tabs.sendMessage(message.tabId, {
      type: message.type,
      payload: message.payload || {},
    }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse(response || { ok: false, error: 'A extensão não confirmou a etapa.' });
    });
    return true;
  }
  if (message?.type !== 'CREATE_SHOPEE') {
    sendResponse({ ok: false, error: 'Tipo desconhecido' });
    return false;
  }

  const rawPayload = message.payload;
  if (
    !rawPayload ||
    typeof rawPayload.nome !== 'string' ||
    !rawPayload.nome.trim() ||
    typeof rawPayload.nome_optimized !== 'string' ||
    !rawPayload.nome_optimized.trim() ||
    typeof rawPayload.descricao_optimized !== 'string' ||
    !rawPayload.descricao_optimized.trim()
  ) {
    sendResponse({ ok: false, error: 'Anúncio inválido ou ainda não gerado.' });
    return false;
  }
  const generatedImageUrl = rawPayload.generated_image_url;
  if (
    typeof generatedImageUrl !== 'string' ||
    !generatedImageUrl.startsWith(
      'https://chthfkbrkcwgcsijwjix.supabase.co/storage/v1/object/public/produtos/',
    )
  ) {
    sendResponse({ ok: false, error: 'Imagem do anúncio inválida ou não gerada.' });
    return false;
  }
  const categoryPath = Array.isArray(rawPayload.category_path) &&
      rawPayload.category_path.length >= 2 &&
      rawPayload.category_path.length <= 5 &&
      rawPayload.category_path.every((category) =>
        typeof category === 'string' &&
        category.trim().length > 0 &&
        category.trim().length <= 100
      )
    ? rawPayload.category_path.map((category) => category.trim())
    : undefined;
  if (categoryPath === undefined) {
    sendResponse({ ok: false, error: 'Categoria do anúncio inválida.' });
    return false;
  }
  const modelType = rawPayload.model_type == null ? 'simple' : rawPayload.model_type;
  if (!['simple', 'variants'].includes(modelType)) {
    sendResponse({ ok: false, error: 'Tipo de anúncio inválido.' });
    return false;
  }
  const numericFields = ['weight_kg', 'width_cm', 'length_cm', 'height_cm'];
  if (!numericFields.every((field) =>
    typeof rawPayload[field] === 'number' &&
    Number.isFinite(rawPayload[field]) &&
    rawPayload[field] > 0
  )) {
    sendResponse({ ok: false, error: 'Peso e dimensões do anúncio são inválidos.' });
    return false;
  }
  const salePrice = rawPayload.sale_price == null
    ? null
    : typeof rawPayload.sale_price === 'number' &&
      Number.isFinite(rawPayload.sale_price) &&
      rawPayload.sale_price > 0
      ? rawPayload.sale_price
      : undefined;
  if (salePrice === undefined) {
    sendResponse({ ok: false, error: 'Preço de venda inválido.' });
    return false;
  }
  const payload = {
    nome: rawPayload.nome.trim().slice(0, 200),
    descricao: typeof rawPayload.descricao === 'string'
      ? rawPayload.descricao.trim().slice(0, 5000)
      : '',
    nome_optimized: rawPayload.nome_optimized.trim().slice(0, 80),
    descricao_optimized: rawPayload.descricao_optimized.trim().slice(0, 2000),
    category_path: categoryPath,
    generated_image_url: generatedImageUrl,
    sale_price: salePrice,
    model_type: modelType,
    weight_kg: rawPayload.weight_kg,
    width_cm: rawPayload.width_cm,
    length_cm: rawPayload.length_cm,
    height_cm: rawPayload.height_cm,
  };

  if (message.tabId != null) {
    if (!Number.isInteger(message.tabId) || message.tabId <= 0) {
      sendResponse({ ok: false, error: 'Aba do UpSeller inválida.' });
      return false;
    }
    pendingPayloads.set(message.tabId, payload);
    pendingExternalResponses.set(message.tabId, sendResponse);
    dispatchFill(message.tabId);
    return true;
  }

  console.log('[Upseller Bridge] Abrindo formulário do Upseller.');
  chrome.tabs.create({ url: UPS_CREATE_URL, active: true }, (tab) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    if (!tab?.id) {
      sendResponse({ ok: false, error: 'Não foi possível abrir a aba do Upseller.' });
      return;
    }
    pendingPayloads.set(tab.id, payload);
    pendingExternalResponses.set(tab.id, sendResponse);
    if (readyTabs.delete(tab.id)) dispatchFill(tab.id);
  });

  return true;
});

// Quando content-script avisa que página carregou (CONTENT_READY)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'CONTENT_READY') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'Sem tabId' });
      return false;
    }

    if (pendingPrepareResponses.has(tabId)) {
      sendResponse({ ok: true, phase: 'preparing' });
      dispatchPrepare(tabId);
      return false;
    }

    const payload = pendingPayloads.get(tabId);
    if (!payload) {
      readyTabs.add(tabId);
      sendResponse({ ok: true, waiting: true });
      return false;
    }

    dispatchFill(tabId, sendResponse);
    return true;
  }

  if (message?.type === 'FILL_RESULT') {
    const tabId = sender.tab?.id;
    if (tabId) pendingPayloads.delete(tabId);
  }
});

// Limpeza se aba fechar sem completar
chrome.tabs.onRemoved.addListener((tabId) => {
  pendingPayloads.delete(tabId);
  readyTabs.delete(tabId);
  const prepareResponse = pendingPrepareResponses.get(tabId);
  if (prepareResponse) {
    pendingPrepareResponses.delete(tabId);
    prepareResponse({ ok: false, error: 'A aba do UpSeller foi fechada antes de selecionar a loja.', tabId });
  }
  const externalResponse = pendingExternalResponses.get(tabId);
  if (externalResponse) {
    pendingExternalResponses.delete(tabId);
    externalResponse({ ok: false, error: 'A aba do UpSeller foi fechada antes do preenchimento terminar.', tabId });
  }
});

console.log('[Upseller Bridge] Background service worker iniciado.');