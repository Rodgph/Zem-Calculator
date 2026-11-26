// content-script.js - Injeta na página de criar anúncio Shopee do Upseller
// Aguarda o formulário carregar e preenche os dados do anúncio.

console.log('[Upseller Bridge] Content script carregado');

let selectedStoreInfo = null;
let activeProgressToast = null;

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
  model: {
    variants: '#sales > div.ant-card-body > div > form.my_form_model.mb_20.ant-form.ant-form-horizontal > div > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div > div > label:nth-child(2) > span.ant-radio > input',
  },
  salePrice: '#sales > div.ant-card-body > div > div > form > div.ant-row.ant-form-item.ant-form-item-with-help > div.ant-col.ant-col-20.ant-form-item-control-wrapper > div > span > span > div > div.ant-input-number-input-wrap > input',
  promotion: '#sales > div.ant-card-body > div > form.my_form_model.mt_20.ant-form.ant-form-horizontal > div.mb_20.promotion.ant-row.ant-form-item > div.ant-col.ant-col-15.ant-form-item-control-wrapper > div > span > div > div > div > div.ant-select-search.ant-select-search--inline > div > input',
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
      #upseller-bridge-progress {
        position: fixed; top: 18px; right: 18px; z-index: 2147483647;
        display: flex; align-items: center; gap: 12px; max-width: 380px;
        padding: 14px 17px; border: 1px solid rgba(145,240,202,.35);
        border-radius: 12px; color: #e7fff5; background: rgba(15,24,31,.96);
        box-shadow: 0 12px 40px rgba(0,0,0,.4); font: 600 13px/1.45 Arial,sans-serif;
      }
      #upseller-bridge-progress .indicator {
        display: grid; flex: 0 0 22px; width: 22px; height: 22px;
        place-items: center; border: 2px solid rgba(145,240,202,.25);
        border-top-color: #91f0ca; border-radius: 50%;
        animation: upseller-bridge-spin .8s linear infinite;
      }
      #upseller-bridge-progress.done .indicator {
        animation: none; border: 0; color: #91f0ca; font-size: 21px;
      }
      #upseller-bridge-progress.failed {
        border-color: rgba(255,133,139,.45); color: #ffe4e5;
      }
      #upseller-bridge-progress.failed .indicator {
        animation: none; border-color: #ff858b; color: #ff858b;
      }
    `;
    document.documentElement.appendChild(style);
  }

  const toast = document.createElement('div');
  toast.id = 'upseller-bridge-progress';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  const indicator = document.createElement('span');
  indicator.className = 'indicator';
  indicator.setAttribute('aria-hidden', 'true');
  const message = document.createElement('span');
  toast.append(indicator, message);
  document.body.appendChild(toast);

  function finish(state, text) {
    toast.className = state;
    indicator.textContent = state === 'done' ? '✓' : '!';
    message.textContent = text;
    window.setTimeout(() => toast.remove(), 10000);
  }

  const progressToast = {
    update(text) {
      message.textContent = text;
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

function waitForCategoryItem(category, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const expected = normalizeUiText(category);
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const modal = findVisibleCategoryModal();
      if (!modal) return;
      const matches = Array.from(modal.querySelectorAll(CATEGORY_SELECTORS.items))
        .filter(isVisible)
        .filter(item => {
          const label = item.querySelector(CATEGORY_SELECTORS.itemName);
          return normalizeUiText(label?.textContent || label?.getAttribute('title')) === expected;
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
    categoryPath.length < 2 ||
    categoryPath.length > 5 ||
    !categoryPath.every(category => typeof category === 'string' && category.trim())
  ) {
    throw new Error('Caminho de categoria inválido.');
  }

  const input = await waitForElement([CATEGORY_SELECTORS.input], 8000);
  const originalValue = getCategoryInputValue(input);
  if (originalValue) return originalValue;

  const openButton = document.querySelector(CATEGORY_SELECTORS.openButton);
  if (openButton && isVisible(openButton)) openButton.click();
  else input.click();
  await delay(350);

  const modal = findVisibleCategoryModal();
  if (!modal) throw new Error('O modal "Selecionar Categoria" não abriu.');
  await waitForElement([CATEGORY_SELECTORS.search], 8000);

  for (const [index, category] of categoryPath.entries()) {
    const item = await waitForCategoryItem(category);
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    item.click();
    await delay(index < categoryPath.length - 1 ? 500 : 350);
  }

  const confirmButton = await waitForCategoryConfirmButton(modal);
  confirmButton.click();

  await delay(250);
  const selectedCategory = await waitForSelectedCategory(
    input,
    originalValue,
    categoryPath[categoryPath.length - 1],
  );
  if (findVisibleCategoryModal()) throw new Error('O modal de categoria permaneceu aberto após confirmar.');
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
    if (message.status === 'error') activeProgressToast.fail(message.text);
    else activeProgressToast.update(message.text);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'FILL_TITLE_CATEGORY') {
    const progress = activeProgressToast || createProgressToast();
    (async () => {
      try {
        progress.update('Passo 2/13 · Preenchendo o nome do anúncio...');
        const titleInput = await waitForElement(SELECTORS.titulo);
        fillInput(titleInput, message.payload.nome_optimized);
        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        progress.update('Passo 3/13 · Selecionando a categoria...');
        await selectListingCategory(message.payload.category_path);
        progress.update('Nome e categoria preenchidos.');
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
        progress.update('Passo 4/13 · Preenchendo a descrição...');
        const descriptionInput = await waitForElement(SELECTORS.descricao, 8000);
        fillTextarea(descriptionInput, message.payload.description_optimized);
        descriptionInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        progress.update('Descrição preenchida.');
        sendResponse({ ok: true });
      } catch (error) {
        progress.fail(`Falha ao preencher descrição: ${error.message}`);
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
        progress.update('Passo 5/13 · Selecionando modelo simples ou com variantes...');
        const modelType = await selectModelType(payload.model_type);
        results.modelType = modelType;

        if (modelType === 'simple' && payload.sale_price != null) {
          progress.update('Passo 6/13 · Elevando o preço para configurar promoção...');
          await fillNumericField(
            LISTING_SELECTORS.salePrice,
            payload.sale_price,
            'preço de venda',
            '#sales',
            /\bpreco\b/,
          );

          progress.update('Passo 7/13 · Selecionando a primeira promoção...');
          const promotionInput = await waitForElement([LISTING_SELECTORS.promotion], 8000);
          promotionInput.click();
          await delay(300);
          const firstOption = Array.from(document.querySelectorAll(
            '.ant-select-dropdown:not(.ant-select-dropdown-hidden) [role="option"], .ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'
          )).find(isVisible);
          if (!firstOption) throw new Error('Primeira promoção não encontrada.');
          firstOption.click();

          progress.update('Passo 8/13 · Informando o valor promocional...');
          await fillNumericField(
            LISTING_SELECTORS.promotionalPrice,
            payload.sale_price,
            'valor promocional',
            '#sales',
            /\bpreco\b/,
          );

          progress.update('Passo 9/13 · Informando estoque promocional zero...');
          const promotionalStock = await waitForElement([LISTING_SELECTORS.promotionalStock], 8000);
          fillInput(promotionalStock, '0');
        }

        progress.update('Passo 10/13 · Preenchendo peso...');
        await fillNumericField(LISTING_SELECTORS.weight, payload.weight_kg, 'peso_kg', '#shopping', /\bpeso\b/);

        progress.update('Passo 11/13 · Preenchendo largura, comprimento e altura...');
        for (const [field, selector, value] of [
          ['largura_cm', LISTING_SELECTORS.dimensions[0], payload.width_cm],
          ['comprimento_cm', LISTING_SELECTORS.dimensions[1], payload.length_cm],
          ['altura_cm', LISTING_SELECTORS.dimensions[2], payload.height_cm],
        ]) {
          await fillNumericField(selector, value, field);
        }

        progress.update('Passo 12/13 · Selecionando métodos de envio...');
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
        progress.update('Passo 13/13 · Adicionando imagens semelhantes em diferentes ângulos...');
        const urls = Array.isArray(message.payload.generated_image_urls)
          ? message.payload.generated_image_urls
          : [message.payload.generated_image_url].filter(Boolean);
        for (const [index, imageUrl] of urls.slice(0, 9).entries()) {
          progress.update(`Passo 13/13 · Adicionando imagem ${index + 1} de ${urls.slice(0, 9).length}...`);
          await addGeneratedImage(imageUrl);
        }
        progress.complete('Anúncio preenchido em etapas. Confira antes de publicar.');
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
        progress.update('Etapa 1/7 · Selecionando a primeira loja...');
        try {
          selectedStoreInfo = await selectFirstStore();
          results.loja = selectedStoreInfo;
        } catch (error) {
          console.error('[Upseller Bridge] Não foi possível selecionar a primeira loja:', error);
          results.errors.push({ field: 'loja', error: error.message });
        }
      }

      progress.update('Passo 2/3 · Preenchendo o nome gerado pelo sistema...');
      // 1. PREENCHE TÍTULO (usa otimizado se disponível)
      const tituloValue = payload.nome_optimized || payload.nome;
      if (tituloValue) {
        const tituloInput = await waitForElement(SELECTORS.titulo);
        fillInput(tituloInput, tituloValue);
        tituloInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        results.filled.push({ field: 'titulo' });
      }

      // 2. PREENCHE DESCRIÇÃO (usa otimizada se disponível)
      progress.update('Etapa 3/7 · Preenchendo a descrição...');
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
        progress.update('Passo 3/3 · Selecionando a categoria sugerida pela IA...');
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

      progress.update('Etapa 5/7 · Configurando modelo, preço, peso e medidas...');
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

      progress.update('Etapa 6/7 · Selecionando opções de envio...');
      for (const selector of LISTING_SELECTORS.logistics) {
        try {
          await selectLogisticsCheckbox(selector);
        } catch (error) {
          console.error('[Upseller Bridge] Não foi possível selecionar uma opção de logística:', error);
          results.errors.push({ field: 'logistica', error: error.message });
        }
      }

      progress.update('Etapa 7/7 · Adicionando a foto principal gerada...');
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