// content-script.js - Injeta na página de criar anúncio Shopee do Upseller
// Aguarda o formulário carregar e preenche os dados do anúncio.

console.log('[Upseller Bridge] Content script carregado');

let selectedStoreInfo = null;
let activeProgressToast = null;

function generateSku(title) {
  const base = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${base}-${random}`;
}

// Seletores para campos do formulário Upseller (Ant Design)
const SELECTORS = {
  // Título do anúncio (Nome do produto)
  titulo: [
    'input.ant-input[data-market-mate-context-menu-target="true"]',
    'input.ant-input[maxlength="10000"]',
    'input.ant-input[suffix-width="l"]',
    'input[name="name"]',
    'input[name="title"]',
    'input[name="product_name"]',
    'input[placeholder*="nome" i]',
    'input[placeholder*="título" i]',
    'input[placeholder*="title" i]',
    'input[id*="name" i]',
    'input[id*="title" i]',
    'form input[type="text"]:not([hidden])',
    'form input:not([type]):not([hidden])',
  ],
  // Descrição do anúncio - textarea ou input grande
  descricao: [
    'textarea.ant-input[rows]',
    'textarea.ant-input',
    'textarea[name="description"]',
    'textarea[name="descricao"]',
    'textarea[placeholder*="descri" i]',
    'textarea[placeholder*="detail" i]',
    'div.ant-input-rich-text-editor', // Rich text editor Ant Design
    'div[contenteditable="true"]',
  ],
  loja: [
    '#basic > div.ant-card-body > div > form > div.ant-row.ant-form-item.ant-form-item-with-help > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div',
    'form .ant-select-selector',
    'form [role="combobox"]',
  ],
};

const LISTING_SELECTORS = {
  sku: [
    '#basic > div.ant-card-body > div > form > div:nth-child(5) > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > input',
    'input[name="sku"]',
    'input[name="product_sku"]',
    'input[placeholder*="sku" i]',
    'input[placeholder*="código" i]',
    'input[placeholder*="codigo" i]',
    'input[id*="sku" i]',
  ],
  model: {
    variants: '#sales > div.ant-card-body > div > form.my_form_model.mb_20.ant-form.ant-form-horizontal > div > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div > div > label:nth-child(2) > span.ant-radio > input',
  },
  salePrice: '#sales > div.ant-card-body > div > div > form > div.ant-row.ant-form-item.ant-form-item-with-help > div.ant-col.ant-col-20.ant-form-item-control-wrapper > div > span > span > div > div.ant-input-number-input-wrap > input',
  // Seletores de promoção mais robustos (fallbacks)
  promotion: [
    // Seletor original
    '#sales > div.ant-card-body > div > form.my_form_model.mt_20.ant-form.ant-form-horizontal > div.mb_20.promotion.ant-row.ant-form-item > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div > div > div > div.ant-select-search.ant-select-search--inline > div > input',
    // Fallbacks mais genéricos
    '#sales .promotion .ant-select-search__field',
    '#sales .promotion input[role="combobox"]',
    '#sales .promotion .ant-select-selector',
    '#sales [class*="promotion"] .ant-select-search input',
    '#sales .ant-form-item:has(label:contains("promoção" i)) .ant-select-search input',
    '#sales .ant-form-item:has(label:contains("promocao" i)) .ant-select-search input',
  ],
  promotionalPrice: '#sales > div.ant-card-body > div > form.my_form_model.mt_20.ant-form.ant-form-horizontal > div:nth-child(2) > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div:nth-child(1) > div.ant-col.ant-col-18.ant-form-item-control-wrapper > div > span > div > div.flex.center_align > span.my_input_number_box.show_addon_before.style_type1 > div > div.ant-input-number-input-wrap > input',
  promotionalStock: '#sales > div.ant-card-body > div > form.my_form_model.mt_20.ant-form.ant-form-horizontal > div:nth-child(2) > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div:nth-child(2) > div.ant-col.ant-col-18.ant-form-item-control-wrapper > div > span > div > span.my_input_number_box.style_type1 > div > div.ant-input-number-input-wrap > input',
  weight: '#shopping > div.ant-card-body > div > form > div.weight_item.ant-row.ant-form-item.ant-form-item-with-help > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > span > div > div.ant-input-number-input-wrap > input',
  dimensions: [
    '#shopping > div.ant-card-body > div > form > div.size_item.ant-row.ant-form-item > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > span:nth-child(1) > div > div.ant-input-number-input-wrap > input',
    '#shopping > div.ant-card-body > div > form > div.size_item.ant-row.ant-form-item > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > span.my_input_number_box.w_140.t_l.ml_12.show_addon_after.style_type1 > div > div.ant-input-number-input-wrap > input',
    '#shopping > div.ant-card-body > div > form > div.size_item.ant-row.ant-form-item > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > span.my_input_number_box.t_r.w_140.ml_12.show_addon_after.style_type1 > div > div.ant-input-number-input-wrap > input',
  ],
  logistics: [
    '#shopping > div.ant-card-body > div > form > div:nth-child(3) > div.ant-col.ant-col-20.ant-form-item-control-wrapper > div > span > div > div.vxe-table--render-wrapper > div.vxe-table--main-wrapper > div.vxe-table--header-wrapper.body--wrapper > table > thead > tr > th.vxe-header--column.col_2.col--checkbox > div > span > span > span.vxe-checkbox--icon.vxe-icon-checkbox-unchecked',
    '#shopping > div.ant-card-body > div > form > div:nth-child(3) > div.ant-col.ant-col-20.ant-form-item-control-wrapper > div > span > div > div.vxe-table--render-wrapper > div.vxe-table--main-wrapper > div.vxe-table--body-wrapper.body--wrapper > table > tbody > tr:nth-child(1) > td.vxe-body--column.col_2.col--checkbox.logistic_name_box > div > span > span.vxe-checkbox--icon.vxe-icon-checkbox-unchecked',
    '#shopping > div.ant-card-body > div > form > div:nth-child(3) > div.ant-col.ant-col-20.ant-form-item-control-wrapper > div > span > div > div.vxe-table--render-wrapper > div.vxe-table--main-wrapper > div.vxe-table--body-wrapper.body--wrapper > table > tbody > tr:nth-child(2) > td.vxe-body--column.col_2.col--checkbox.logistic_name_box > div > span > span.vxe-checkbox--icon.vxe-icon-checkbox-unchecked',
  ],
};

const MEDIA_SELECTORS = {
  addImages: '#media .ant-dropdown-trigger, #media button, #media a, #media [role="button"]',
  webLinkMenu: '[role="menuitem"], .ant-dropdown-menu-item, li',
  linkTextarea: '.ant-modal-content .ant-modal-body textarea',
  linkConfirmButton: 'body > div:nth-child(33) > div > div.ant-modal-wrap > div > div.ant-modal-content > div.ant-modal-footer > div > div:nth-child(2) > div > div.ant-space.ant-space-horizontal.ant-space-align-center > div:nth-child(2) > button',
};

const CATEGORY_SELECTORS = {
  openButton: '#basic > div.ant-card-body > div > form > div:nth-child(3) > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div.form_item_suffix.ml_10.d_ib > button',
  input: '#basic input[placeholder="Selecionar uma Categoria"]',
  modal: '.ant-modal-content',
  modalTitle: '.ant-modal-title',
  search: 'input[placeholder="Buscar o nome da categoria"], #myInput[placeholder="Pesquisar Categoria"], .category_list input[placeholder="Pesquisar Categoria"]',
  items: '.category_list .category_column_list.pointer',
  itemName: '.category_name',
  panel: '.category_list',
};

function waitForElement(selectors, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      for (const sel of selectors) {
        try {
          const el = document.querySelector(sel);
          if (el && isVisible(el)) {
            clearInterval(interval);
            resolve(el);
            return;
          }
        } catch (e) {
          // Seletor inválido, ignora
        }
      }
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout esperando elemento: ${selectors.join(', ')}`));
      }
    }, 300);
  });
}

function findLabeledInput(sectionSelector, selector, labelPattern) {
  try {
    const selected = document.querySelector(selector);
    if (selected && isVisible(selected)) return selected;
  } catch (error) {
    console.warn('[Upseller Bridge] Seletor de campo inválido:', error.message);
  }

  const section = document.querySelector(sectionSelector);
  if (!section) return null;
  const item = Array.from(section.querySelectorAll('.ant-form-item')).find((candidate) => {
    const label = candidate.querySelector('.ant-form-item-label')?.textContent ||
      candidate.querySelector('label')?.textContent ||
      '';
    const normalizedLabel = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return labelPattern.test(normalizedLabel);
  });
  const input = item?.querySelector('input:not([type="radio"]):not([type="checkbox"])');
  return input && isVisible(input) ? input : null;
}

function waitForLabeledInput(sectionSelector, selector, labelPattern, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const input = findLabeledInput(sectionSelector, selector, labelPattern);
      if (input) {
        clearInterval(interval);
        resolve(input);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error(`Campo "${labelPattern.source}" não encontrado em ${sectionSelector}.`));
      }
    }, 200);
  });
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
}

function fillInput(input, value) {
  input.focus();
  const prototype = input instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!nativeValueSetter) throw new Error('Não foi possível atualizar o campo do formulário.');
  nativeValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

function fillTextarea(textarea, value) {
  // Para textarea ou contenteditable
  if (textarea.tagName === 'TEXTAREA') {
    fillInput(textarea, value);
    return;
  }
  // ContentEditable (rich text editor)
  if (textarea.isContentEditable || textarea.getAttribute('contenteditable') === 'true') {
    textarea.focus();
    textarea.replaceChildren();
    value.split('\n').forEach((line, index) => {
      if (index > 0) textarea.appendChild(document.createElement('br'));
      textarea.appendChild(document.createTextNode(line));
    });
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  throw new Error('O campo de descrição não é compatível.');
}

function findModelOption(modelType) {
  const salesSection = document.querySelector('#sales');
  const pattern = modelType === 'simple' ? /\bsimples\b/i : /\bvariantes\b/i;
  const option = Array.from(salesSection?.querySelectorAll('label.ant-radio-wrapper') || [])
    .find(label => pattern.test(label.textContent || ''));
  if (option) return option;
  if (modelType === 'variants') {
    return document.querySelector(LISTING_SELECTORS.model.variants);
  }
  return null;
}

function isModelOptionSelected(option) {
  if (option.matches('input[type="radio"]')) return option.checked;
  return option.classList.contains('ant-radio-wrapper-checked') ||
    Boolean(option.querySelector('input[type="radio"]')?.checked);
}

function selectModelType(modelType, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let clicked = false;
    const interval = setInterval(() => {
      const option = findModelOption(modelType);
      if (option && isModelOptionSelected(option)) {
        clearInterval(interval);
        resolve(modelType);
        return;
      }

      if (option && !clicked) {
        const input = option.matches('input[type="radio"]')
          ? option
          : option.querySelector('input[type="radio"]');
        if (!input) {
          clearInterval(interval);
          reject(new Error(`Opção ${modelType} não contém um controle de rádio.`));
          return;
        }
        input.click();
        clicked = true;
      }

      if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error(`Não foi possível selecionar o modelo ${modelType}.`));
      }
    }, 200);
  });
}

async function fillNumericField(selector, value, field, sectionSelector, labelPattern) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Valor inválido para ${field}.`);
  }
  const input = sectionSelector
    ? await waitForLabeledInput(sectionSelector, selector, labelPattern, 8000)
    : await waitForElement([selector], 8000);
  fillInput(input, String(value));
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function normalizeUiText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function waitForTextElement(selector, text, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const element = Array.from(document.querySelectorAll(selector)).find(candidate =>
        isVisible(candidate) && normalizeUiText(candidate.textContent).includes(normalizeUiText(text))
      );
      if (element) {
        clearInterval(interval);
        resolve(element);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error(`Elemento "${text}" não encontrado.`));
      }
    }, 200);
  });
}

function waitForAddImagesButton(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const labels = ['adicionar imagens', 'add images'];
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const matchesLabel = candidate =>
        isVisible(candidate) &&
        labels.some(label => normalizeUiText(candidate.textContent).includes(label));
      const scopedCandidates = Array.from(document.querySelectorAll(MEDIA_SELECTORS.addImages))
        .filter(matchesLabel);
      const globalCandidates = Array.from(document.querySelectorAll(
        'button, a, [role="button"], .ant-dropdown-trigger'
      )).filter(matchesLabel);
      const candidates = [...new Set([...scopedCandidates, ...globalCandidates])];
      const candidate = scopedCandidates.find(element => element.tagName === 'BUTTON') ||
        scopedCandidates[0] ||
        globalCandidates.find(element => element.tagName === 'BUTTON') ||
        globalCandidates[0];
      const trigger = candidate?.closest('.ant-dropdown-trigger') ||
        candidates.find(element => element.matches('.ant-dropdown-trigger'));
      if (trigger || candidate) {
        clearInterval(interval);
        resolve(trigger || candidate);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('Botão "Adicionar Imagens" não encontrado.'));
      }
    }, 200);
  });
}

async function openImageMenu() {
  const trigger = await waitForAddImagesButton();
  trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
  trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
  trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, view: window }));
  await delay(250);

  try {
    return await waitForWebLinkMenuOption(1200);
  } catch (error) {
    if (!error.message.includes('O menu de imagens não abriu')) throw error;
    trigger.click();
    return waitForWebLinkMenuOption();
  }
}

function waitForWebLinkMenuOption(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const option = Array.from(document.querySelectorAll(MEDIA_SELECTORS.webLinkMenu)).find(candidate => {
        if (!isVisible(candidate)) return false;
        const text = normalizeUiText(candidate.textContent);
        return text.includes('a partir de web (link)') || text.includes('from web (link)');
      });
      if (option) {
        clearInterval(interval);
        resolve(option);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('O menu de imagens não abriu ou a opção "A Partir de Web (Link)" não apareceu.'));
      }
    }, 200);
  });
}

function getVisibleImageLinkModal() {
  return Array.from(document.querySelectorAll('.ant-modal-wrap')).find(isVisible) || null;
}

function waitForImageLinkTextarea(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const modal = getVisibleImageLinkModal();
      const textarea = modal?.querySelector(MEDIA_SELECTORS.linkTextarea) ||
        document.querySelector('body > div:nth-child(33) > div > div.ant-modal-wrap > div > div.ant-modal-content > div.ant-modal-body > textarea');
      if (textarea && isVisible(textarea)) {
        clearInterval(interval);
        resolve(textarea);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('Campo do link da imagem não encontrado.'));
      }
    }, 200);
  });
}

function waitForImageLinkConfirmButton(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const modal = getVisibleImageLinkModal();
      const buttons = Array.from(modal?.querySelectorAll('.ant-modal-footer button') || [])
        .filter(button => isVisible(button) && !button.disabled);
      const providedSelectorButton = document.querySelector(MEDIA_SELECTORS.linkConfirmButton);
      const button = buttons.find(candidate =>
        /^(confirmar|confirm|adicionar|importar|ok)$/.test(normalizeUiText(candidate.textContent))
      ) || (providedSelectorButton && isVisible(providedSelectorButton) && !providedSelectorButton.disabled
        ? providedSelectorButton
        : buttons[buttons.length - 1]);
      if (button && isVisible(button) && !button.disabled) {
        clearInterval(interval);
        resolve(button);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('Botão de confirmar o link da imagem não encontrado.'));
      }
    }, 200);
  });
}

function getMediaImages() {
  return Array.from(document.querySelectorAll('#media img'));
}

function getMediaImageSnapshot() {
  return getMediaImages().map(image =>
    image.currentSrc || image.src || image.getAttribute('src') || ''
  );
}

function waitForMediaImage(previousSources, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const currentImages = getMediaImages();
      const imageWasAddedOrUpdated = currentImages.some((image, index) => {
        const source = image.currentSrc || image.src || image.getAttribute('src') || '';
        const previousSource = previousSources[index] || '';
        return source && image.naturalWidth > 0 &&
          (index >= previousSources.length || source !== previousSource);
      });
      if (imageWasAddedOrUpdated) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        const visibleCount = currentImages.filter(isVisible).length;
        reject(new Error(`O UpSeller não exibiu a imagem na galeria (imagens visíveis: ${visibleCount}).`));
      }
    }, 300);
  });
}

async function addGeneratedImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(
    'https://chthfkbrkcwgcsijwjix.supabase.co/storage/v1/object/public/produtos/',
  )) {
    throw new Error('URL da imagem gerada inválida.');
  }

  const previousImageSources = getMediaImageSnapshot();
  const webLinkOption = await openImageMenu();
  webLinkOption.click();

  const textarea = await waitForImageLinkTextarea();
  fillInput(textarea, imageUrl);
  if (textarea.value.trim() !== imageUrl) {
    throw new Error('O link da imagem não permaneceu no campo do UpSeller.');
  }
  const confirmButton = await waitForImageLinkConfirmButton();
  confirmButton.click();
  await waitForMediaImage(previousImageSources);
}

async function selectLogisticsCheckbox(uncheckedSelector) {
  const checkedSelector = uncheckedSelector.replace(
    'vxe-icon-checkbox-unchecked',
    'vxe-icon-checkbox-checked'
  );
  const indeterminateSelector = uncheckedSelector.replace(
    'vxe-icon-checkbox-unchecked',
    'vxe-icon-checkbox-indeterminate'
  );
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    const checked = document.querySelector(checkedSelector);
    if (checked && isVisible(checked)) return;

    const checkbox = document.querySelector(uncheckedSelector) ||
      document.querySelector(indeterminateSelector);
    if (checkbox && isVisible(checkbox)) {
      checkbox.click();
      const clickedAt = Date.now();
      while (Date.now() - clickedAt < 2000) {
        const selected = document.querySelector(checkedSelector);
        if (selected && isVisible(selected)) return;
        await delay(100);
      }
      throw new Error('Não foi possível selecionar a opção de logística.');
    }
    await delay(200);
  }
  throw new Error('Opção de logística não encontrada.');
}

function createProgressToast() {
  document.getElementById('upseller-bridge-progress')?.remove();
  if (!document.getElementById('upseller-bridge-progress-style')) {
    const style = document.createElement('style');
    style.id = 'upseller-bridge-progress-style';
    style.textContent = `
      @keyframes upseller-bridge-spin { to { transform: rotate(360deg); } }
      @keyframes upseller-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(.8); } }
      #upseller-bridge-progress {
        position: fixed; top: 18px; right: 18px; z-index: 2147483647;
        min-width: 320px; max-width: 420px;
        border: 1px solid rgba(145,240,202,.35);
        border-radius: 12px; color: #e7fff5; background: rgba(15,24,31,.98);
        box-shadow: 0 12px 40px rgba(0,0,0,.5); font: 12px/1.4 Arial,sans-serif;
        overflow: hidden;
      }
      #upseller-bridge-progress .header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px; border-bottom: 1px solid rgba(145,240,202,.15);
        background: rgba(145,240,202,.05);
      }
      #upseller-bridge-progress .title { font-weight: 700; font-size: 13px; }
      #upseller-bridge-progress .store-badge {
        font-size: 10px; padding: 2px 8px; border: 1px solid rgba(77,182,245,.3);
        border-radius: 4px; color: #4db6f5; background: rgba(77,182,245,.1);
      }
      #upseller-bridge-progress .overall-progress {
        display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      }
      #upseller-bridge-progress .bar-track {
        flex: 1; height: 6px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden;
      }
      #upseller-bridge-progress .bar-fill {
        height: 100%; border-radius: 3px; background: linear-gradient(90deg, #91f0ca, #5ed7ad);
        transition: width .4s ease; box-shadow: 0 0 8px rgba(145,240,202,.5);
      }
      #upseller-bridge-progress .percent { font-variant-numeric: tabular-nums; font-weight: 700; color: #91f0ca; font-size: 12px; min-width: 36px; text-align: right; }
      #upseller-bridge-progress .steps { padding: 8px 12px; max-height: 300px; overflow-y: auto; }
      #upseller-bridge-progress .step {
        display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px;
        border-radius: 8px; margin-bottom: 6px; transition: all .2s ease;
      }
      #upseller-bridge-progress .step.pending { background: transparent; }
      #upseller-bridge-progress .step.active { background: rgba(145,240,202,.08); }
      #upseller-bridge-progress .step.complete { background: rgba(145,240,202,.04); }
      #upseller-bridge-progress .step.error { background: rgba(255,133,139,.08); }
      #upseller-bridge-progress .step-icon {
        flex: 0 0 24px; display: grid; place-items: center;
        width: 24px; height: 24px; border-radius: 50%; font-size: 11px; font-weight: 800;
      }
      #upseller-bridge-progress .step.pending .step-icon { border: 1px solid rgba(255,255,255,.15); color: #9da8ba; background: rgba(255,255,255,.03); }
      #upseller-bridge-progress .step.active .step-icon { border: 1px solid #91f0ca; color: #07130f; background: #91f0ca; }
      #upseller-bridge-progress .step.complete .step-icon { border: none; color: #07130f; background: #91f0ca; }
      #upseller-bridge-progress .step.error .step-icon { border: none; color: #fff; background: #d95762; }
      #upseller-bridge-progress .step-icon.spinning::before { content: ''; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: upseller-bridge-spin .7s linear infinite; position: absolute; }
      #upseller-bridge-progress .step-content { flex: 1; min-width: 0; display: grid; gap: 3px; }
      #upseller-bridge-progress .step-label { font-weight: 600; font-size: 12px; color: #e4e9f2; }
      #upseller-bridge-progress .step.active .step-label { color: #91f0ca; }
      #upseller-bridge-progress .step-detail { font-size: 10px; color: #9da8ba; line-height: 1.3; }
      #upseller-bridge-progress .step-live { display: flex; align-items: center; gap: 6px; margin-top: 4px; padding: 4px 8px; border: 1px solid rgba(145,240,202,.2); border-radius: 4px; background: rgba(145,240,202,.04); font-size: 10px; color: #91f0ca; }
      #upseller-bridge-progress .live-dot { width: 5px; height: 5px; border-radius: 50%; background: #91f0ca; animation: upseller-pulse 1.5s ease-in-out infinite; }
      #upseller-bridge-progress .step-error { margin-top: 4px; padding: 4px 8px; border: 1px solid rgba(255,133,139,.3); border-radius: 4px; background: rgba(255,133,139,.08); color: #ffc0c3; font-size: 10px; }
      #upseller-bridge-progress .sse-status { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid rgba(77,182,245,.15); background: rgba(77,182,245,.05); font-size: 10px; color: #4db6f5; }
      #upseller-bridge-progress .sse-dot { width: 6px; height: 6px; border-radius: 50%; background: #4db6f5; animation: upseller-pulse 2s ease-in-out infinite; }
      #upseller-bridge-progress.done { border-color: rgba(145,240,202,.4); }
      #upseller-bridge-progress.failed { border-color: rgba(255,133,139,.45); color: #ffe4e5; }
    `;
    document.documentElement.appendChild(style);
  }

  const stages = [
    { key: 'opening', label: 'Abrir UpSeller e selecionar loja', detail: 'A aba abre e seleciona sua loja automaticamente' },
    { key: 'reading', label: 'Lendo título e descrição', detail: 'Processando nome e descrição do produto' },
    { key: 'vision', label: 'Analisando imagens (Visão computacional)', detail: 'GPT-4o Vision identifica produto, materiais, cores, acessórios nas fotos' },
    { key: 'web_search', label: 'Buscando no Shopee, ML, 1688, Alibaba', detail: 'Enriquecendo com preços, specs e reviews reais de mercado' },
    { key: 'synthesis', label: 'Sintetizando anúncio completo', detail: 'Título otimizado, categoria 5 níveis, descrição rica, peso/medidas' },
    { key: 'image_generation', label: 'Gerando imagem profissional', detail: 'Foto quadrada, fundo branco, sem embalagem de transporte' },
    { key: 'filling', label: 'Preenchendo no UpSeller', detail: 'Nome, categoria, descrição, SKU, preço, medidas, logística, imagem' },
  ];

  const toast = document.createElement('div');
  toast.id = 'upseller-bridge-progress';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  toast.innerHTML = `
    <div class="header">
      <span class="title">Gerando anúncio com IA</span>
      <span class="store-badge" style="display:none;"></span>
    </div>
    <div class="overall-progress">
      <div class="bar-track"><div class="bar-fill" style="width:0%"></div></div>
      <span class="percent">0%</span>
    </div>
    <div class="steps"></div>
    <div class="sse-status" style="display:none;"><span class="sse-dot" aria-hidden="true"></span><span>Conectado à IA — recebendo atualizações em tempo real</span></div>
  `;

  document.body.appendChild(toast);

  const stepsContainer = toast.querySelector('.steps');
  const barFill = toast.querySelector('.bar-fill');
  const percentEl = toast.querySelector('.percent');
  const storeBadge = toast.querySelector('.store-badge');
  const sseStatus = toast.querySelector('.sse-status');

  // Render steps
  stages.forEach((stage, index) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'step pending';
    stepEl.dataset.step = stage.key;
    stepEl.innerHTML = `
      <div class="step-icon">${index + 1}</div>
      <div class="step-content">
        <div class="step-label">${stage.label}</div>
        <div class="step-detail">${stage.detail}</div>
      </div>
    `;
    stepsContainer.appendChild(stepEl);
  });

  let currentStageIndex = -1;
  let isGeneratingPhase = false;

  function updateOverallProgress() {
    const total = stages.length;
    const progress = isGeneratingPhase && currentStageIndex >= 0
      ? Math.round(((currentStageIndex + 0.3) / total) * 100)
      : currentStageIndex >= 0
        ? Math.round(((currentStageIndex + 1) / total) * 100)
        : 0;
    barFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    percentEl.textContent = `${Math.min(100, Math.max(0, progress))}%`;
  }

  function setStageStatus(index, status, liveMessage, errorMessage) {
    const stepEl = stepsContainer.children[index];
    if (!stepEl) return;
    stepEl.className = `step ${status}`;
    const icon = stepEl.querySelector('.step-icon');
    if (status === 'active') {
      icon.innerHTML = '<span class="spinning" aria-hidden="true"></span>';
    } else if (status === 'complete') {
      icon.textContent = '✓';
    } else if (status === 'error') {
      icon.textContent = '!';
    } else {
      icon.textContent = index + 1;
    }
    if (liveMessage) {
      let liveEl = stepEl.querySelector('.step-live');
      if (!liveEl) {
        liveEl = document.createElement('div');
        liveEl.className = 'step-live';
        stepEl.querySelector('.step-content').appendChild(liveEl);
      }
      liveEl.innerHTML = `<span class="live-dot" aria-hidden="true"></span><span>${liveMessage}</span>`;
    }
    if (errorMessage) {
      let errEl = stepEl.querySelector('.step-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'step-error';
        stepEl.querySelector('.step-content').appendChild(errEl);
      }
      errEl.textContent = errorMessage;
    }
  }

  function finish(state, text) {
    toast.className = state;
    const title = toast.querySelector('.title');
    if (title) title.textContent = state === 'done' ? 'Anúncio preparado!' : 'Falha na geração';
    // Mark all remaining as complete or error
    for (let i = 0; i < stages.length; i++) {
      const stepEl = stepsContainer.children[i];
      if (stepEl && stepEl.classList.contains('pending')) {
        setStageStatus(i, state === 'done' ? 'complete' : 'error');
      }
    }
    updateOverallProgress();
    // Auto-close after 15s for success, 30s for error
    window.setTimeout(() => toast.remove(), state === 'done' ? 15000 : 30000);
  }

  const progressToast = {
    update(data) {
      // data can be string (legacy) or object with { stage, step, message, storeName, data }
      if (typeof data === 'string') {
        // Legacy: just update a generic message
        const activeStep = stepsContainer.querySelector('.step.active');
        if (activeStep) {
          let liveEl = activeStep.querySelector('.step-live');
          if (!liveEl) {
            liveEl = document.createElement('div');
            liveEl.className = 'step-live';
            activeStep.querySelector('.step-content').appendChild(liveEl);
          }
          liveEl.innerHTML = `<span class="live-dot" aria-hidden="true"></span><span>${data}</span>`;
        }
        return;
      }

      const { stage, step, message: msg, storeName, totalStages, data: stepData } = data;

      if (storeName && storeBadge) {
        storeBadge.textContent = `Loja: ${storeName}`;
        storeBadge.style.display = 'inline-block';
      }

      if (step === 'connecting' || step === 'opening') {
        isGeneratingPhase = false;
        currentStageIndex = 0;
        setStageStatus(0, 'active', msg);
        updateOverallProgress();
        return;
      }

      if (['reading', 'vision', 'web_search', 'synthesis', 'image_generation'].includes(step)) {
        isGeneratingPhase = true;
        sseStatus.style.display = 'flex';
        const stageIdx = stages.findIndex(s => s.key === step);
        if (stageIdx >= 0) {
          // Mark previous as complete
          for (let i = 0; i < stageIdx; i++) {
            if (!stepsContainer.children[i].classList.contains('complete')) {
              setStageStatus(i, 'complete');
            }
          }
          currentStageIndex = stageIdx;
          setStageStatus(stageIdx, 'active', msg);
          updateOverallProgress();
        }
        return;
      }

      if (step === 'filling') {
        isGeneratingPhase = false;
        sseStatus.style.display = 'none';
        // Mark all generation steps complete
        for (let i = 0; i < 6; i++) {
          if (!stepsContainer.children[i].classList.contains('complete')) {
            setStageStatus(i, 'complete');
          }
        }
        currentStageIndex = 6;
        setStageStatus(6, 'active', msg);
        updateOverallProgress();
        return;
      }

      if (step === 'complete') {
        isGeneratingPhase = false;
        sseStatus.style.display = 'none';
        setStageStatus(6, 'complete');
        updateOverallProgress();
        finish('done', msg || 'Anúncio preparado! Confira antes de publicar.');
        return;
      }

      if (step === 'error') {
        isGeneratingPhase = false;
        sseStatus.style.display = 'none';
        if (currentStageIndex >= 0) {
          setStageStatus(currentStageIndex, 'error', null, msg);
        }
        finish('failed', msg || 'Erro na geração do anúncio.');
        return;
      }
    },
    complete(text) {
      finish('done', text);
    },
    fail(text) {
      finish('failed', text);
    },
  };
  activeProgressToast = progressToast;
  return progressToast;
}

function findStoreSelector() {
  const labeledItem = Array.from(document.querySelectorAll('.ant-form-item')).find((item) => {
    const label = item.querySelector('label')?.textContent || '';
    return /loja|store/i.test(label);
  });
  const selector = labeledItem?.querySelector('.ant-select-selector, [role="combobox"]');
  if (selector && isVisible(selector)) return selector;

  for (const candidate of SELECTORS.loja) {
    try {
      const element = document.querySelector(candidate);
      if (element && isVisible(element)) return element;
    } catch (error) {
      console.warn('[Upseller Bridge] Seletor de loja inválido:', error.message);
    }
  }
  return null;
}

function waitForStoreSelector(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const selector = findStoreSelector();
      if (selector) {
        clearInterval(interval);
        resolve(selector);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('Campo de loja não encontrado.'));
      }
    }, 300);
  });
}

function waitForFirstStoreOption(timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const options = Array.from(document.querySelectorAll(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option, [role="listbox"] [role="option"]'
      ));
      const option = options.find(item =>
        isVisible(item) &&
        item.getAttribute('aria-disabled') !== 'true' &&
        !item.classList.contains('ant-select-item-option-disabled')
      );
      if (option) {
        clearInterval(interval);
        resolve(option);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('Nenhuma opção de loja disponível.'));
      }
    }, 200);
  });
}

async function selectFirstStore() {
  const selector = await waitForStoreSelector();
  selector.click();
  const option = await waitForFirstStoreOption();
  const value = option.textContent?.trim() || option.getAttribute('title') || '';
  option.click();
  return { selected: true, value };
}

function getCategoryInputValue(input) {
  const value = input.value.trim() || input.getAttribute('title')?.trim() || '';
  return normalizeUiText(value) === normalizeUiText(input.placeholder) ? '' : value;
}

function getVisibleCategoryColumns(modal) {
  return Array.from(modal.querySelectorAll('.category_list'))
    .filter(isVisible);
}

function waitForCategoryColumn(modal, level, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const columns = getVisibleCategoryColumns(modal);
      if (columns[level]) {
        clearInterval(interval);
        resolve(columns[level]);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error(`Bloco de categoria do nível ${level + 1} não apareceu.`));
      }
    }, 200);
  });
}

function waitForCategoryItem(category, level, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const expected = normalizeUiText(category);
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const modal = findVisibleCategoryModal();
      if (!modal) return;
      const columns = getVisibleCategoryColumns(modal);
      const column = columns[level];
      if (!column) {
        if (columns.length > level) return;
        return;
      }
      const matches = Array.from(column.querySelectorAll(CATEGORY_SELECTORS.items))
        .filter(isVisible)
        .filter(item => {
          const label = item.querySelector(CATEGORY_SELECTORS.itemName);
          const name = label?.textContent || label?.getAttribute('title') || '';
          const normalizedName = normalizeUiText(name);
          return normalizedName === expected ||
            normalizedName.includes(expected) ||
            expected.includes(normalizedName);
        });
      if (matches.length > 0) {
        clearInterval(interval);
        resolve(matches[matches.length - 1]);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error(`Categoria "${category}" não encontrada no seletor do UpSeller.`));
      }
    }, 200);
  });
}

function waitForCategoryItemFuzzy(category, level, modal, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const keywords = normalizeUiText(category).split(/\s+/).filter(w => w.length > 2);
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (!modal) return;
      const columns = getVisibleCategoryColumns(modal);
      const column = columns[level];
      if (!column) {
        if (columns.length > level) return;
        return;
      }
      const items = Array.from(column.querySelectorAll(CATEGORY_SELECTORS.items))
        .filter(isVisible);
      let bestMatch = null;
      let bestScore = 0;
      for (const item of items) {
        const label = item.querySelector(CATEGORY_SELECTORS.itemName);
        const name = label?.textContent || label?.getAttribute('title') || '';
        const normalizedName = normalizeUiText(name);
        let score = 0;
        for (const kw of keywords) {
          if (normalizedName.includes(kw)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = item;
        }
      }
      if (bestMatch && bestScore > 0) {
        clearInterval(interval);
        console.log(`[Upseller Bridge] Match fuzzy: "${category}" -> "${bestMatch.textContent?.trim()}" (score: ${bestScore})`);
        resolve(bestMatch);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error(`Fuzzy match falhou para "${category}"`));
      }
    }, 200);
  });
}

function waitForSelectedCategory(input, originalValue, leafCategory, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const expectedLeaf = normalizeUiText(leafCategory);
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const value = getCategoryInputValue(input);
      if (
        value &&
        value !== originalValue &&
        normalizeUiText(value).includes(expectedLeaf)
      ) {
        clearInterval(interval);
        resolve(value);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('O UpSeller não confirmou a categoria selecionada.'));
      }
    }, 200);
  });
}

function findVisibleCategoryModal() {
  return Array.from(document.querySelectorAll(CATEGORY_SELECTORS.modal))
    .find(modal =>
      isVisible(modal) &&
      normalizeUiText(modal.querySelector(CATEGORY_SELECTORS.modalTitle)?.textContent) === 'selecionar categoria'
    );
}

function findCategoryConfirmButton(modal) {
  // Seletor específico do botão "Selecionar" do modal de categoria (Ant Design)
  const specificSelector =
    'body > div:nth-child(27) > div > div.ant-modal-wrap > div > div.ant-modal-content > div.ant-modal-footer > div > div:nth-child(2) > div > div.ant-space.ant-space-horizontal.ant-space-align-center > div:nth-child(2) > button';
  const specificButton = modal.querySelector(specificSelector) || document.querySelector(specificSelector);
  if (specificButton && isVisible(specificButton) && !specificButton.disabled) {
    console.log('[Upseller Bridge] Botão "Selecionar" encontrado via seletor específico');
    return specificButton;
  }

  // Fallback: busca genérica por botão com texto "Selecionar"
  return Array.from(modal.querySelectorAll('button'))
    .find(button =>
      isVisible(button) &&
      !button.disabled &&
      normalizeUiText(button.textContent) === 'selecionar'
    );
}

function waitForCategoryConfirmButton(modal, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const button = findCategoryConfirmButton(modal);
      if (button) {
        clearInterval(interval);
        resolve(button);
      } else if (Date.now() - startedAt > timeout) {
        clearInterval(interval);
        reject(new Error('O botão "Selecionar" da categoria não foi habilitado.'));
      }
    }, 200);
  });
}

async function selectListingCategory(categoryPath) {
  if (
    !Array.isArray(categoryPath) ||
    categoryPath.length < 3 || // Mínimo 3 níveis para Shopee
    categoryPath.length > 5 ||
    !categoryPath.every(category => typeof category === 'string' && category.trim())
  ) {
    throw new Error('Caminho de categoria inválido (precisa de 3 a 5 níveis).');
  }

  const input = await waitForElement([CATEGORY_SELECTORS.input], 8000);
  const originalValue = getCategoryInputValue(input);
  if (originalValue) {
    console.log('[Upseller Bridge] Categoria existente será substituída:', originalValue);
  }

  const openButton = document.querySelector(CATEGORY_SELECTORS.openButton);
  if (openButton && isVisible(openButton)) openButton.click();
  else input.click();
  await delay(350);

  const modal = findVisibleCategoryModal();
  if (!modal) throw new Error('O modal "Selecionar Categoria" não abriu.');
  await waitForElement([CATEGORY_SELECTORS.search], 8000);

  for (const [index, category] of categoryPath.entries()) {
    const isLast = index === categoryPath.length - 1;
    let column;
    try {
      column = await waitForCategoryColumn(modal, index);
    } catch (e) {
      console.warn(`[Upseller Bridge] Coluna do nível ${index + 1} não apareceu, pulando...`);
      if (isLast) break;
      continue;
    }
    let item;
    try {
      item = await waitForCategoryItem(category, index);
    } catch (e) {
      // Tenta busca fuzzy se não encontrou exato
      console.warn(`[Upseller Bridge] Categoria "${category}" não encontrada no nível ${index + 1}, tentando busca parcial...`);
      try {
        item = await waitForCategoryItemFuzzy(category, index, modal);
      } catch (fuzzyError) {
        console.warn(`[Upseller Bridge] Busca fuzzy também falhou para "${category}", pulando nível...`);
        if (isLast) break;
        continue;
      }
    }
    if (!item) {
      console.warn(`[Upseller Bridge] Item não resolvido para "${category}", pulando...`);
      if (isLast) break;
      continue;
    }
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    const selectedLabel = item.querySelector(CATEGORY_SELECTORS.itemName);
    const foundName = selectedLabel?.textContent?.trim() || category;
    console.log('[Upseller Bridge] Selecionando categoria', {
      level: index + 1,
      totalLevels: categoryPath.length,
      category,
      found: foundName,
      isLastLevel: isLast,
    });
    item.click();
    // Mais tempo no último nível para o botão "Selecionar" habilitar
    await delay(isLast ? 1500 : 1000);
  }

  const confirmButton = await waitForCategoryConfirmButton(modal);
  console.log('[Upseller Bridge] Clicando no botão "Selecionar" da categoria');
  confirmButton.click();

  // Espera o modal fechar completamente
  await delay(500);
  let modalStillOpen = findVisibleCategoryModal();
  let attempts = 0;
  while (modalStillOpen && attempts < 10) {
    await delay(200);
    modalStillOpen = findVisibleCategoryModal();
    attempts++;
  }
  if (modalStillOpen) {
    console.warn('[Upseller Bridge] Modal ainda aberto após confirmar, tentando fechar via ESC');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await delay(300);
  }

  const selectedCategory = await waitForSelectedCategory(
    input,
    originalValue,
    categoryPath[categoryPath.length - 1],
  );
  if (findVisibleCategoryModal()) throw new Error('O modal de categoria permaneceu aberto após confirmar.');
  console.log('[Upseller Bridge] Categoria confirmada:', selectedCategory);
  return selectedCategory;
}

// Escuta mensagem do background com o payload
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PREPARE_FORM') {
    console.log('[Upseller Bridge] Preparando formulário antes da geração.');
    const progress = createProgressToast();
    (async () => {
      try {
        progress.update('Etapa 1/7 · Abrindo o formulário e selecionando a loja...');
        selectedStoreInfo = await selectFirstStore();
        progress.update(
          `Etapa 1/7 · Loja ${selectedStoreInfo.value} selecionada. Aguardando geração do conteúdo e da imagem...`,
        );
        sendResponse({ ok: true, store: selectedStoreInfo });
      } catch (error) {
        selectedStoreInfo = null;
        console.error('[Upseller Bridge] Não foi possível preparar o formulário:', error);
        progress.fail(`Não foi possível selecionar a loja: ${error.message}`);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'UPDATE_PROGRESS') {
    if (!activeProgressToast) {
      sendResponse({ ok: false, error: 'Aviso de progresso não encontrado.' });
      return false;
    }
    // Support both legacy (text/status) and new (step/stage/message/data) formats
    if (message.status === 'error') {
      activeProgressToast.fail(message.text || message.message || 'Erro desconhecido');
    } else {
      activeProgressToast.update({
        stage: message.stage,
        step: message.step,
        message: message.message || message.text,
        storeName: message.storeName,
        totalStages: message.totalStages,
        data: message.data,
      });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'FILL_TITLE_CATEGORY') {
    const progress = activeProgressToast || createProgressToast();
    (async () => {
      try {
        progress.update({ step: 'filling', message: 'Preenchendo nome do anúncio...' });
        const titleInput = await waitForElement(SELECTORS.titulo);
        fillInput(titleInput, message.payload.nome_optimized);
        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        progress.update({ step: 'filling', message: 'Selecionando a categoria...' });
        await selectListingCategory(message.payload.category_path);
        progress.update({ step: 'filling', message: 'Nome e categoria preenchidos.' });
        sendResponse({ ok: true });
      } catch (error) {
        progress.fail(`Falha ao preencher nome ou categoria: ${error.message}`);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'FILL_DESCRIPTION') {
    const progress = activeProgressToast || createProgressToast();
    (async () => {
      try {
        progress.update({ step: 'filling', message: 'Preenchendo a descrição...' });
        const descriptionInput = await waitForElement(SELECTORS.descricao, 8000);
        fillTextarea(descriptionInput, message.payload.description_optimized);
        descriptionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        progress.update({ step: 'filling', message: 'Descrição preenchida.' });
        sendResponse({ ok: true });
      } catch (error) {
        progress.fail(`Falha ao preencher descrição: ${error.message}`);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'FILL_SKU') {
    const progress = activeProgressToast || createProgressToast();
    (async () => {
      try {
        progress.update({ step: 'filling', message: 'Preenchendo SKU...' });
        const skuInput = await waitForElement(LISTING_SELECTORS.sku, 8000);
        const skuValue = message.payload.sku || generateSku(message.payload.nome_optimized);
        fillInput(skuInput, skuValue);
        skuInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        progress.update({ step: 'filling', message: 'SKU preenchido.' });
        sendResponse({ ok: true, sku: skuValue });
      } catch (error) {
        progress.fail(`Falha ao preencher SKU: ${error.message}`);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type === 'FILL_MODEL_PRICE_SHIPPING') {
    const progress = activeProgressToast || createProgressToast();
    (async () => {
      const payload = message.payload;
      const results = { filled: [], errors: [] };
      try {
        progress.update({ step: 'filling', message: 'Selecionando modelo (simples/variantes)...' });
        const modelType = await selectModelType(payload.model_type);
        results.modelType = modelType;

        if (modelType === 'simple' && payload.sale_price != null) {
          progress.update({ step: 'filling', message: 'Configurando preço de venda...' });
          await fillNumericField(
            LISTING_SELECTORS.salePrice,
            payload.sale_price,
            'preço de venda',
            '#sales',
            /\bpreco\b/,
          );

          // Aguarda a promoção aparecer após definir o preço
          await delay(800);

          progress.update({ step: 'filling', message: 'Selecionando promoção...' });
          const promotionSelectors = Array.isArray(LISTING_SELECTORS.promotion)
            ? LISTING_SELECTORS.promotion
            : [LISTING_SELECTORS.promotion];
          let promotionInput = null;
          for (const selector of promotionSelectors) {
            try {
              promotionInput = await waitForElement([selector], 5000);
              if (promotionInput) break;
            } catch (e) {
              // Tenta próximo seletor
            }
          }
          if (!promotionInput) {
            console.warn('[Upseller Bridge] Campo de promoção não encontrado, pulando...');
            results.filled.push({ field: 'promocao', skipped: true, reason: 'campo não encontrado' });
          } else {
            promotionInput.click();
            await delay(300);
            const firstOption = Array.from(document.querySelectorAll(
              '.ant-select-dropdown:not(.ant-select-dropdown-hidden) [role="option"], .ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'
            )).find(isVisible);
            if (!firstOption) throw new Error('Primeira promoção não encontrada.');
            firstOption.click();
            results.filled.push({ field: 'promocao' });

            progress.update({ step: 'filling', message: 'Informando valor promocional...' });
            await fillNumericField(
              LISTING_SELECTORS.promotionalPrice,
              payload.sale_price,
              'valor promocional',
              '#sales',
              /\bpreco\b/,
            );

            progress.update({ step: 'filling', message: 'Informando estoque promocional...' });
            const promotionalStock = await waitForElement([LISTING_SELECTORS.promotionalStock], 8000);
            fillInput(promotionalStock, '0');
            results.filled.push({ field: 'promocao_preco' }, { field: 'promocao_estoque' });
          }
        }

        progress.update({ step: 'filling', message: 'Preenchendo peso...' });
        await fillNumericField(LISTING_SELECTORS.weight, payload.weight_kg, 'peso_kg', '#shopping', /\bpeso\b/);

        progress.update({ step: 'filling', message: 'Preenchendo dimensões (largura, comprimento, altura)...' });
        for (const [field, selector, value] of [
          ['largura_cm', LISTING_SELECTORS.dimensions[0], payload.width_cm],
          ['comprimento_cm', LISTING_SELECTORS.dimensions[1], payload.length_cm],
          ['altura_cm', LISTING_SELECTORS.dimensions[2], payload.height_cm],
        ]) {
          await fillNumericField(selector, value, field);
        }

        progress.update({ step: 'filling', message: 'Selecionando métodos de envio...' });
        for (const selector of LISTING_SELECTORS.logistics) {
          await selectLogisticsCheckbox(selector);
        }

        sendResponse({ ok: true, ...results });
      } catch (error) {
        progress.fail(`Falha nas configurações do anúncio: ${error.message}`);
        sendResponse({ ok: false, error: error.message, ...results });
      }
    })();
    return true;
  }

  if (message.type === 'FILL_IMAGES') {
    const progress = activeProgressToast || createProgressToast();
    (async () => {
      try {
        progress.update({ step: 'filling', message: 'Adicionando imagens geradas...' });
        const urls = Array.isArray(message.payload.generated_image_urls)
          ? message.payload.generated_image_urls
          : [message.payload.generated_image_url].filter(Boolean);
        for (const [index, imageUrl] of urls.slice(0, 9).entries()) {
          progress.update({ step: 'filling', message: `Adicionando imagem ${index + 1} de ${urls.slice(0, 9).length}...` });
          await addGeneratedImage(imageUrl);
        }
        progress.complete('Anúncio preenchido! Confira antes de publicar.');
        sendResponse({ ok: true });
      } catch (error) {
        progress.fail(`Falha ao adicionar imagens: ${error.message}`);
        sendResponse({ ok: false, error: error.message });
      }
    })();
    return true;
  }

  if (message.type !== 'FILL_FORM') return;

  const { payload } = message;
  console.log('[Upseller Bridge] Iniciando preenchimento do anúncio.');

  (async () => {
    const results = { filled: [], errors: [] };
    const progress = activeProgressToast || createProgressToast();
    try {
      if (selectedStoreInfo) {
        results.loja = selectedStoreInfo;
      } else {
        progress.update({ step: 'opening', message: 'Selecionando a primeira loja...' });
        try {
          selectedStoreInfo = await selectFirstStore();
          results.loja = selectedStoreInfo;
        } catch (error) {
          console.error('[Upseller Bridge] Não foi possível selecionar a primeira loja:', error);
          results.errors.push({ field: 'loja', error: error.message });
        }
      }

      progress.update({ step: 'filling', message: 'Preenchendo o nome do anúncio...' });
      // 1. PREENCHE TÍTULO (usa otimizado se disponível)
      const tituloValue = payload.nome_optimized || payload.nome;
      if (tituloValue) {
        const tituloInput = await waitForElement(SELECTORS.titulo);
        fillInput(tituloInput, tituloValue);
        tituloInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        results.filled.push({ field: 'titulo' });
      }

      // 2. PREENCHE DESCRIÇÃO (usa otimizada se disponível)
      progress.update({ step: 'filling', message: 'Preenchendo a descrição...' });
      const descValue = payload.descricao_optimized || payload.descricao;
      if (descValue) {
        try {
          const descInput = await waitForElement(SELECTORS.descricao, 8000); // timeout menor
          fillTextarea(descInput, descValue);
          descInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          results.filled.push({ field: 'descricao', chars: descValue.length });
        } catch (e) {
          console.warn('[Upseller Bridge] Campo descrição não encontrado (opcional):', e.message);
          results.filled.push({ field: 'descricao', skipped: true, reason: e.message });
        }
      }

      if (payload.category_path?.length) {
        progress.update({ step: 'filling', message: 'Selecionando a categoria sugerida pela IA...' });
        try {
          results.categoria = await selectListingCategory(payload.category_path);
          results.filled.push({ field: 'categoria' });
        } catch (error) {
          console.error('[Upseller Bridge] Não foi possível selecionar a categoria:', error);
          results.errors.push({ field: 'categoria', error: error.message });
        }
      } else {
        const error = 'A função de geração não retornou o caminho da categoria.';
        console.error('[Upseller Bridge]', error);
        results.errors.push({ field: 'categoria', error });
      }

      progress.update({ step: 'filling', message: 'Configurando modelo, preço, peso e medidas...' });
      try {
        results.modelType = await selectModelType(payload.model_type);
      } catch (error) {
        console.error('[Upseller Bridge] Não foi possível selecionar o modelo do anúncio:', error);
        results.errors.push({ field: 'modelo', error: error.message });
      }

      if (results.modelType === 'simple' && payload.sale_price != null) {
        try {
          await fillNumericField(
            LISTING_SELECTORS.salePrice,
            payload.sale_price,
            'preço de venda',
            '#sales',
            /\bpreco\b/,
          );
          results.filled.push({ field: 'preco_venda' });
        } catch (error) {
          console.error('[Upseller Bridge] Não foi possível preencher o preço:', error);
          results.errors.push({ field: 'preco_venda', error: error.message });
        }
      } else if (results.modelType === 'variants') {
        results.filled.push({ field: 'preco_venda', skipped: true, reason: 'produto com variantes' });
      } else if (payload.sale_price == null) {
        results.filled.push({ field: 'preco_venda', skipped: true, reason: 'preço não cadastrado' });
      }

      const numericFields = [
        ['peso_kg', LISTING_SELECTORS.weight, payload.weight_kg, '#shopping', /\bpeso\b/],
        ['largura_cm', LISTING_SELECTORS.dimensions[0], payload.width_cm],
        ['comprimento_cm', LISTING_SELECTORS.dimensions[1], payload.length_cm],
        ['altura_cm', LISTING_SELECTORS.dimensions[2], payload.height_cm],
      ];
      for (const [field, selector, value, sectionSelector, labelPattern] of numericFields) {
        try {
          await fillNumericField(selector, value, field, sectionSelector, labelPattern);
          results.filled.push({ field });
        } catch (error) {
          console.error(`[Upseller Bridge] Não foi possível preencher ${field}:`, error);
          results.errors.push({ field, error: error.message });
        }
      }

      progress.update({ step: 'filling', message: 'Selecionando opções de envio...' });
      for (const selector of LISTING_SELECTORS.logistics) {
        try {
          await selectLogisticsCheckbox(selector);
        } catch (error) {
          console.error('[Upseller Bridge] Não foi possível selecionar uma opção de logística:', error);
          results.errors.push({ field: 'logistica', error: error.message });
        }
      }

      progress.update({ step: 'filling', message: 'Adicionando a foto principal gerada...' });
      try {
        await addGeneratedImage(payload.generated_image_url);
        results.filled.push({ field: 'imagem_gerada' });
      } catch (error) {
        console.error('[Upseller Bridge] Não foi possível adicionar a imagem gerada:', error);
        results.errors.push({ field: 'imagem_gerada', error: error.message });
      }

      if (results.errors.length === 0) {
        progress.complete('Anúncio preenchido e foto adicionada. Confira tudo antes de publicar.');
      } else {
        const failures = [...new Set(results.errors.map(item =>
          item.error ? `${item.field}: ${item.error}` : item.field
        ))].join('; ');
        progress.fail(`Concluído com falhas: ${failures}. Confira antes de publicar.`);
      }
      sendResponse({ ok: results.errors.length === 0, ...results });
    } catch (err) {
      console.error('[Upseller Bridge] Erro ao preencher:', err);
      progress.fail(`O robô parou: ${err.message}`);
      sendResponse({ ok: false, error: err.message, ...results });
    } finally {
      chrome.runtime.sendMessage({ type: 'FILL_RESULT' });
    }
  })();

  return true; // Assíncrono
});

// Avisa background que content script está pronto
chrome.runtime.sendMessage({ type: 'CONTENT_READY' }, (response) => {
  if (chrome.runtime.lastError) {
    console.log('[Upseller Bridge] Background não respondeu (normal na primeira carga):', chrome.runtime.lastError.message);
  } else {
    console.log('[Upseller Bridge] Background confirmou:', response);
  }
});