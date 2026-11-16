// Baixa uma imagem de outro site pelo servidor da Vercel (contorna o bloqueio CORS do navegador).
const blocked = h => !h || h === 'localhost' || h.includes(':') ||
  /^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(h) || /\.(local|internal)$/.test(h);

module.exports = async (req, res) => {
  try {
    const u = new URL(req.query.url);
    if (!/^https?:$/.test(u.protocol) || blocked(u.hostname)) throw new Error('endereço não permitido');
    const r = await fetch(u, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': u.origin + '/' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });
    if (blocked(new URL(r.url).hostname)) throw new Error('endereço não permitido');
    if (!r.ok) throw new Error('o site respondeu ' + r.status);
    const type = r.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error('não é uma imagem');
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) throw new Error('imagem grande demais');
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(buf);
  } catch (e) {
    res.status(400).json({ erro: String(e.message || e) });
  }
};
