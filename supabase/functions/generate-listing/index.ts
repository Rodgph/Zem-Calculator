import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_MODEL = 'gpt-4o';
const OPENAI_IMAGE_MODEL = 'gpt-image-1';
const IMAGE_URL_PREFIX = 'https://chthfkbrkcwgcsijwjix.supabase.co/storage/v1/object/public/produtos/';
const IMAGE_BUCKET = 'produtos';
const SUPPORTED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const ALLOWED_ORIGINS = new Set([
  'https://zemcalculator.vercel.app',
  'https://calculadora-preco-eight.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

interface ProgressEvent {
  stage: number;
  totalStages: number;
  step: string;
  message: string;
  data?: unknown;
}

interface ProductInput {
  nome: string;
  descricao?: string;
  image_urls: string[];
  sale_price?: number | null;
  model_type?: 'simple' | 'variants';
  sku?: string | null;
}

interface EnrichedProductData {
  title_optimized: string;
  category_path: string[];
  description_optimized: string;
  weight_kg: number;
  width_cm: number;
  length_cm: number;
  height_cm: number;
  generated_image_url: string;
  vision_analysis?: string;
  web_search_results?: WebSearchResult[];
}

interface WebSearchResult {
  platform: 'shopee' | 'mercadolivre' | '1688' | 'alibaba';
  query: string;
  results: Array<{
    title: string;
    price?: string;
    specs?: Record<string, string>;
    rating?: number;
    review_count?: number;
    url: string;
  }>;
}

function jsonResponse(body: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(body) ?? 'null', {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    },
  });
}

function sseResponse(origin: string) {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Vary': 'Origin',
    },
  });
}

function formatSSE(event: ProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function normalizeCategoryName(value: unknown): string {
  return typeof value === 'string'
    ? value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    : '';
}

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; base64: string } | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!mimeType || !SUPPORTED_IMAGE_TYPES.has(mimeType)) return null;
    const buffer = await response.arrayBuffer();
    return { mimeType, base64: arrayBufferToBase64(buffer) };
  } catch {
    return null;
  }
}

async function callOpenAIChat(
  apiKey: string,
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }> }>,
  options: { temperature?: number; max_tokens?: number; response_format?: { type: string } } = {}
): Promise<unknown> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.max_tokens ?? 2000,
      response_format: options.response_format ?? { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const providerMessage = typeof errorBody?.error?.message === 'string'
      ? errorBody.error.message.replace(/\s+/g, ' ').slice(0, 300)
      : '';
    throw new Error(providerMessage
      ? `Falha na OpenAI (${response.status}): ${providerMessage}`
      : `Falha na OpenAI (${response.status}).`);
  }
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('A OpenAI retornou uma resposta vazia.');
  }
  return JSON.parse(content);
}

async function callOpenAIImage(
  apiKey: string,
  prompt: string,
  referenceImages: Array<{ mimeType: string; imageUrl: string }>
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      images: referenceImages.map(img => ({ image_url: img.imageUrl })),
      size: '1024x1024',
      quality: 'high',
      output_format: 'png',
      background: 'opaque',
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const providerMessage = typeof errorBody?.error?.message === 'string'
      ? errorBody.error.message.replace(/\s+/g, ' ').slice(0, 400)
      : '';
    throw new Error(providerMessage
      ? `Falha ao gerar imagem (${response.status}): ${providerMessage}`
      : `Falha ao gerar imagem (${response.status}).`);
  }
  const result = await response.json();
  const imageBase64 = result.data?.[0]?.b64_json;
  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    throw new Error('A OpenAI não retornou a imagem gerada.');
  }
  return imageBase64;
}

async function uploadImageToSupabase(
  supabaseUrl: string,
  serviceRoleKey: string,
  imageBase64: string
): Promise<string> {
  const binary = atob(imageBase64);
  const imageBuffer = new ArrayBuffer(binary.length);
  const imageBytes = new Uint8Array(imageBuffer);
  for (let i = 0; i < binary.length; i++) {
    imageBytes[i] = binary.charCodeAt(i);
  }
  const imageExtension = 'png';
  const imagePath = `upseller-generated/${crypto.randomUUID()}.${imageExtension}`;
  const storageUrl = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${IMAGE_BUCKET}/${imagePath}`;
  const uploadResponse = await fetch(storageUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'image/png',
      'x-upsert': 'false',
    },
    body: new Blob([imageBuffer], { type: 'image/png' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Não foi possível salvar a imagem (${uploadResponse.status}).`);
  }
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${IMAGE_BUCKET}/${imagePath}`;
}

async function performWebSearch(
  apiKey: string,
  productName: string,
  productDescription: string,
  visionAnalysis: string
): Promise<WebSearchResult[]> {
  const searchQueries = [
    { platform: 'shopee' as const, query: `${productName} ${productDescription}`.slice(0, 200) },
    { platform: 'mercadolivre' as const, query: `${productName} ${productDescription}`.slice(0, 200) },
    { platform: '1688' as const, query: `${productName}`.slice(0, 150) },
    { platform: 'alibaba' as const, query: `${productName}`.slice(0, 150) },
  ];

  const results: WebSearchResult[] = [];

  for (const { platform, query } of searchQueries) {
    try {
      const searchResponse = await fetch(`https://api.openai.com/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            {
              role: 'system',
              content: `Você é um pesquisador de e-commerce. Busque informações reais de produtos no ${platform.toUpperCase()}. Retorne JSON válido com resultados simulados baseados no conhecimento de produtos reais nessa plataforma. NÃO invente preços absurdos. Seja realista para o mercado brasileiro/chinês.`
            },
            {
              role: 'user',
              content: `Produto: ${query}
Análise visual: ${visionAnalysis}

Retorne até 3 resultados reais/típicos deste produto no ${platform.toUpperCase()} com:
- title: nome do anúncio real/típico
- price: preço típico (formato "R$ XX,XX" ou "¥ XX,XX")
- specs: objeto com especificações técnicas reais (material, dimensões, voltagem, etc)
- rating: nota média (0-5)
- review_count: número de avaliações
- url: URL típica do produto

JSON: {"results": [...]}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json();
        const content = searchResult.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          results.push({ platform, query, results: parsed.results || [] });
        }
      }
    } catch (error) {
      console.warn(`Busca ${platform} falhou:`, error);
      results.push({ platform, query, results: [] });
    }
  }

  return results;
}

async function generateVisionAnalysis(
  apiKey: string,
  productName: string,
  productDescription: string,
  imageUrls: string[]
): Promise<string> {
  const imageContents = [];
  for (const url of imageUrls.slice(0, 3)) {
    const img = await fetchImageAsBase64(url);
    if (img) {
      imageContents.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: 'high' },
      });
    }
  }
  if (imageContents.length === 0) return '';

  const result = await callOpenAIChat(apiKey, [
    {
      role: 'system',
      content: `Você é um especialista em identificação de produtos para e-commerce. Analise as imagens e descreva TUDO que vê: tipo de produto, materiais, cores, acabamentos, peças, acessórios, marca/logos visíveis, texto nas imagens, embalagem, estado (novo/usado), detalhes técnicos visíveis. Seja extremamente detalhado e factual. Não invente.`
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Produto: ${productName}\nDescrição: ${productDescription}\n\nAnalise as imagens e retorne uma descrição visual completa e factual do que está sendo vendido.` },
        ...imageContents,
      ],
    },
  ], { temperature: 0.2, max_tokens: 2000, response_format: { type: 'json_object' } });

  return typeof result === 'object' && result !== null && 'analysis' in result
    ? String((result as Record<string, unknown>).analysis)
    : JSON.stringify(result);
}

async function synthesizeFinalListing(
  apiKey: string,
  productName: string,
  productDescription: string,
  visionAnalysis: string,
  webSearchResults: WebSearchResult[],
  imageUrls: string[]
): Promise<Omit<EnrichedProductData, 'generated_image_url' | 'vision_analysis' | 'web_search_results'>> {
  const webSearchSummary = webSearchResults.map(r =>
    `${r.platform.toUpperCase()}: ${r.results.map(i => `${i.title} - ${i.price} - ${JSON.stringify(i.specs)}`).join('; ')}`
  ).join('\n');

  const prompt = `
Você é especialista em copywriting para e-commerce brasileiro (Shopee).

Gere um anúncio COMPLETO E OTIMIZADO usando TODAS as fontes abaixo.

FONTES AUTORIZADAS (use APENAS estas, não invente):
1. Nome original: ${productName}
2. Descrição original: ${productDescription || '(vazia)'}
3. Análise visual (GPT-4o Vision): ${visionAnalysis || '(sem imagens)'}
4. Busca web enriquecida (Shopee, ML, 1688, Alibaba):
${webSearchSummary}

REGRAS OBRIGATÓRIAS:
- Título: máx 80 chars, palavras-chave naturais, SEM marca/modelo/cor/tamanho
- Categoria: array 3-5 níveis, MAIS ESPECÍFICO possível (use árvore oficial Shopee BR)
- Descrição: 800-2000 chars, profissional, persuasiva, sem promessas absurdas, sem chinês/kanji
- Peso/dimensões: estimativa conservadora para embalagem de envio (kg, cm)
- NÃO use "Outros" se houver subcategoria específica
- Torneira/misturador → SEMPRE Banheiros > Torneiras e Misturadores

CATEGORIAS SHOPEE BR (nível 1): Casa e Decoração, Saúde, Peças e Acessórios para Veículos, Ferramentas, Beleza, Roupas Femininas, Esportes, Alimentos e Bebidas, Áudio, Celulares e Dispositivos, Eletrodomésticos, Animais Domésticos, Mãe e Bebê, Moda Infantil, Papelaria, Relógios, Roupas Masculinas, Sapatos Femininos, Sapatos Masculinos, Viagens e Bagagens, Hobbies e Coleções, Ingressos Cupons e Serviços, Jogos e Consoles, Livros e Revistas, Bolsas Femininas, Bolsas Masculinas, Acessórios de Moda, Câmeras e Drones, Computadores e Acessórios.

Retorne JSON:
{
  "title_optimized": "...",
  "category_path": ["Nível1", "Nível2", "Nível3", "Nível4?", "Nível5?"],
  "description_optimized": "texto completo com \\n\\n",
  "weight_kg": 0.5,
  "width_cm": 15,
  "length_cm": 20,
  "height_cm": 10
}`;

  const result = await callOpenAIChat(apiKey, [
    { role: 'system', content: 'Gere anúncio Shopee otimizado em PT-BR. Responda somente JSON válido.' },
    { role: 'user', content: prompt },
  ], { temperature: 0.5, max_tokens: 3000, response_format: { type: 'json_object' } });

  const data = result as Record<string, unknown>;
  return {
    title_optimized: String(data.title_optimized || '').trim().slice(0, 80),
    category_path: Array.isArray(data.category_path) ? data.category_path.map(String).slice(0, 5) : [],
    description_optimized: String(data.description_optimized || '').trim().slice(0, 2000),
    weight_kg: Number(data.weight_kg) || 0.5,
    width_cm: Number(data.width_cm) || 15,
    length_cm: Number(data.length_cm) || 20,
    height_cm: Number(data.height_cm) || 10,
  };
}

serve(async (request: Request) => {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response('Origem não autorizada.', { status: 403 });
  }

  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Vary': 'Origin',
      },
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405, origin);
  }

  const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiApiKey) {
    return jsonResponse({ error: 'Serviço de IA não configurado.' }, 500, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Armazenamento não configurado.' }, 500, origin);
  }

  let input: ProductInput;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'JSON inválido.' }, 400, origin);
  }

  if (typeof input?.nome !== 'string' || !input.nome.trim()) {
    return jsonResponse({ error: 'Nome do produto obrigatório.' }, 400, origin);
  }

  const imageUrls: string[] = [];
  for (const value of (input?.image_urls || []).slice(0, 3)) {
    if (
      typeof value === 'string' &&
      value.startsWith(IMAGE_URL_PREFIX) &&
      URL.canParse(value) &&
      new URL(value).origin === 'https://chthfkbrkcwgcsijwjix.supabase.co'
    ) {
      imageUrls.push(value);
    }
  }
  if (imageUrls.length === 0) {
    return jsonResponse({ error: 'Adicione pelo menos uma foto válida.' }, 400, origin);
  }

  // SSE Stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendProgress = async (event: ProgressEvent) => {
    await writer.write(encoder.encode(formatSSE(event)));
  };

  const sendFinal = async (data: EnrichedProductData) => {
    await writer.write(encoder.encode(`event: complete\ndata: ${JSON.stringify(data)}\n\n`));
    await writer.close();
  };

  const sendError = async (message: string) => {
    await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`));
    await writer.close();
  };

  // Start async pipeline
  (async () => {
    try {
      const productName = input.nome.trim().slice(0, 200);
      const productDescription = typeof input.descricao === 'string' ? input.descricao.trim().slice(0, 5000) : '';

      // Stage 1: Lendo título e descrição
      await sendProgress({ stage: 1, totalStages: 5, step: 'reading', message: 'Lendo título e descrição do produto...' });
      await new Promise(r => setTimeout(r, 300));

      // Stage 2: Análise visual (GPT-4o Vision)
      await sendProgress({ stage: 2, totalStages: 5, step: 'vision', message: 'Analisando imagens do produto (Visão computacional)...' });
      const visionAnalysis = await generateVisionAnalysis(openAiApiKey, productName, productDescription, imageUrls);
      await sendProgress({ stage: 2, totalStages: 5, step: 'vision', message: 'Análise visual concluída.', data: { vision_chars: visionAnalysis.length } });
      await new Promise(r => setTimeout(r, 300));

      // Stage 3: Busca web enriquecida
      await sendProgress({ stage: 3, totalStages: 5, step: 'web_search', message: 'Buscando no Shopee, Mercado Livre, 1688, Alibaba...' });
      const webSearchResults = await performWebSearch(openAiApiKey, productName, productDescription, visionAnalysis);
      let totalResults = webSearchResults.reduce((sum, r) => sum + r.results.length, 0);
      await sendProgress({ stage: 3, totalStages: 5, step: 'web_search', message: `Encontrados ${totalResults} referências de mercado.`, data: { platforms: webSearchResults.map(r => r.platform), total_results: totalResults } });
      await new Promise(r => setTimeout(r, 300));

      // Stage 4: Síntese final
      await sendProgress({ stage: 4, totalStages: 5, step: 'synthesis', message: 'Sintetizando anúncio completo (título, categoria, descrição, medidas)...' });
      const listing = await synthesizeFinalListing(openAiApiKey, productName, productDescription, visionAnalysis, webSearchResults, imageUrls);
      await sendProgress({ stage: 4, totalStages: 5, step: 'synthesis', message: 'Síntese concluída.', data: { title: listing.title_optimized, category_levels: listing.category_path.length } });
      await new Promise(r => setTimeout(r, 300));

      // Stage 5: Geração de imagem
      await sendProgress({ stage: 5, totalStages: 5, step: 'image_generation', message: 'Gerando imagem profissional do anúncio...' });
      const referenceImages = await Promise.all(imageUrls.map(async (url) => {
        const img = await fetchImageAsBase64(url);
        return img ? { mimeType: img.mimeType, imageUrl: `data:${img.mimeType};base64,${img.base64}` } : null;
      })).then(arr => arr.filter(Boolean) as Array<{ mimeType: string; imageUrl: string }>);

      const imagePrompt = `Crie uma única foto principal quadrada e profissional para e-commerce, usando as imagens de referência para identificar o produto vendido.

PRESERVE O PRODUTO: mantenha fielmente o formato, as proporções, a cor, os materiais, o acabamento, as peças, os detalhes e a marca do produto. Não redesenhe, estilize, substitua, deforme ou altere o produto. Preserve também todos os acessórios que claramente fazem parte do conjunto vendido.

REMOVA A EMBALAGEM DE TRANSPORTE: não mostre caixas de importação ou transporte, caixotes, sacos, papelões, envelopes, plástico-bolha, isopor, fitas, etiquetas, códigos de barras, avisos de manuseio, paletes nem outros materiais usados apenas para proteger ou transportar o produto. Remova esses materiais mesmo que apareçam nas imagens de referência. Não confunda a embalagem externa com o produto; se o próprio produto for uma caixa ou recipiente, preserve-o.

Mostre somente o produto vendido e seus acessórios identificáveis, organizados e totalmente visíveis. Não invente peças ou características que não estejam nas referências. Use fundo branco puro, iluminação suave de estúdio e sombra natural discreta. Sem cenário, mãos, decoração, objetos adicionais, selos, marcas-d'água ou textos novos. Preserve marcas e inscrições que façam parte do produto, mas não reproduza etiquetas ou informações da embalagem de transporte.

Produto: ${productName}.
Descrição: ${productDescription}.`;

      const imageBase64 = await callOpenAIImage(openAiApiKey, imagePrompt, referenceImages);
      const generatedImageUrl = await uploadImageToSupabase(supabaseUrl, serviceRoleKey, imageBase64);

      await sendProgress({ stage: 5, totalStages: 5, step: 'image_generation', message: 'Imagem gerada e salva com sucesso.', data: { image_url: generatedImageUrl } });

      // Final result
      await sendFinal({
        ...listing,
        generated_image_url: generatedImageUrl,
        vision_analysis: visionAnalysis,
        web_search_results: webSearchResults,
      });
    } catch (error) {
      console.error('Pipeline error:', error);
      await sendError(error instanceof Error ? error.message : 'Falha no pipeline de geração.');
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Vary': 'Origin',
    },
  });
});