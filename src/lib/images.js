import { supabase, IMAGE_BUCKET } from './supabase.js';

export function publicImageUrl(path) {
  return path ? supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl : '';
}

export async function compressImage(file) {
  if (!file?.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');

  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Não consegui ler essa imagem.'));
      image.src = source;
    });

    if (!image.naturalWidth || !image.naturalHeight) throw new Error('A imagem está vazia ou é inválida.');
    const scale = Math.min(1, 480 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não consegui preparar essa imagem.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Não consegui preparar essa imagem.');
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export async function uploadImage(file) {
  const blob = await compressImage(file);
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Erro ao enviar a imagem: ${error.message}`);
  return path;
}

export async function removeImages(paths) {
  const failures = [];
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < uniquePaths.length; i += 100) {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(uniquePaths.slice(i, i + 100));
    if (error) failures.push(error.message);
  }
  return failures;
}

export async function downloadImageUrl(value) {
  let source = String(value || '').trim();
  if (source.startsWith('//')) source = `https:${source}`;
  if (!/^https?:\/\//i.test(source) && !/^data:image\//i.test(source)) {
    throw new Error('O link da imagem precisa ser uma URL http ou https.');
  }

  let response;
  if (source.startsWith('data:')) {
    response = await fetch(source);
  } else {
    try {
      response = await fetch(source);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!(response.headers.get('content-type') || '').startsWith('image/')) {
        throw new Error('O endereço não retornou uma imagem.');
      }
    } catch {
      response = await fetch(`/api/img?url=${encodeURIComponent(source)}`);
    }
  }
  if (!response.ok) throw new Error(`Não consegui baixar a imagem (HTTP ${response.status}).`);

  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('O endereço não retornou uma imagem.');
  if (blob.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
  return new File([blob], 'imagem', { type: blob.type });
}

export async function imageFromTransfer(transfer) {
  const file = transfer.files?.[0];
  if (file?.type.startsWith('image/')) return file;

  const html = transfer.getData('text/html');
  const imageMatch = html && html.match(/<img[^>]+src=["']([^"']+)["']/i);
  const uri = (transfer.getData('text/uri-list') || '')
    .split('\n')
    .find(value => value && value[0] !== '#');
  let source = imageMatch ? imageMatch[1].replace(/&amp;/g, '&') : uri || transfer.getData('text/plain').trim();
  if (source.startsWith('//')) source = `https:${source}`;
  if (!/^(https?:|data:image\/)/i.test(source)) return null;
  return downloadImageUrl(source);
}
