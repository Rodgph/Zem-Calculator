import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ImportDialog from './components/ImportDialog.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import { supabase } from './lib/supabase.js';
import { downloadImageUrl, removeImages, uploadImage } from './lib/images.js';
import { DEFAULT_MARGIN } from './lib/pricing.js';
import { readContainerFile } from './lib/spreadsheet.js';

async function mapWithConcurrency(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  let firstError;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!firstError) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = await callback(items[index], index);
      } catch (error) {
        firstError = error;
      }
    }
  });

  await Promise.all(workers);
  if (firstError) throw firstError;
  return results;
}

function isSpreadsheet(file) {
  return /\.(xlsx|xls|csv)$/i.test(file.name);
}

function NotFound() {
  return (
    <section className="card empty-page">
      <h2>Página não encontrada</h2>
      <Link className="btn" to="/produtos">Voltar aos produtos</Link>
    </section>
  );
}

function LegacyContainerRedirect() {
  const { id } = useParams();
  return <Navigate to={`/produtos?container=${encodeURIComponent(id)}`} replace />;
}

export default function App() {
  const [containers, setContainers] = useState([]);
  const [loadingContainers, setLoadingContainers] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [draggingFile, setDraggingFile] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const fileInput = useRef(null);
  const dragDepth = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshContainers = useCallback(async () => {
    setLoadingContainers(true);
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .order('created_at', { ascending: true });
    setLoadingContainers(false);
    if (error) {
      setLoadError(`Erro ao carregar contêineres: ${error.message}`);
      return [];
    }
    setLoadError('');
    setContainers(data || []);
    return data || [];
  }, []);

  useEffect(() => {
    refreshContainers();
  }, [refreshContainers]);

  function notify(message, type = 'success') {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 5000);
  }

  function openImport(file) {
    if (!isSpreadsheet(file)) {
      notify('Use uma planilha .xlsx, .xls ou .csv.', 'error');
      return;
    }
    setPendingFile(file);
    setImportError('');
    setImportStatus('');
    setImportOpen(true);
  }

  async function importContainer(name) {
    if (!name) {
      setImportError('Informe o nome ou número do contêiner.');
      return;
    }
    setImportBusy(true);
    setImportError('');
    setImportStatus('Lendo planilha...');
    let containerId = null;
    const uploadedImagePaths = [];

    try {
      const imported = await readContainerFile(pendingFile);
      setImportStatus('Criando contêiner...');
      const { data: container, error: createError } = await supabase
        .from('containers')
        .insert({ nome: name })
        .select()
        .single();
      if (createError) throw new Error(`Não foi possível criar o contêiner: ${createError.message}`);
      containerId = container.id;

      let completed = 0;
      const rows = await mapWithConcurrency(imported, 3, async product => {
        async function uploadProductImage(loader, url, label) {
          if (!loader && !url) return null;
          try {
            const imageFile = loader ? await loader() : await downloadImageUrl(url);
            const imagePath = await uploadImage(imageFile);
            uploadedImagePaths.push(imagePath);
            return imagePath;
          } catch (error) {
            throw new Error(`Imagem ${label} do SKU ${product.sku}: ${error.message || String(error)}`);
          }
        }

        const imagePath = await uploadProductImage(product.loadImage, product.imageUrl, 'principal');
        const secondaryImagePath = await uploadProductImage(
          product.loadImageSecondary,
          product.imageUrlSecondary,
          'secundária',
        );
        completed += 1;
        setImportStatus(`Preparando produtos e imagens (${completed}/${imported.length})...`);
        return {
          container_id: container.id,
          nome: product.nome,
          descricao: product.descricao,
          sku: product.sku,
          custo: product.custo,
          shopee: product.shopee,
          img_path: imagePath,
          img_path_secondary: secondaryImagePath,
          margens: { tiktok: DEFAULT_MARGIN, shopee: DEFAULT_MARGIN, ml: DEFAULT_MARGIN },
        };
      });

      setImportStatus('Salvando produtos...');
      for (let index = 0; index < rows.length; index += 500) {
        const { error } = await supabase.from('products').insert(rows.slice(index, index + 500));
        if (error) throw new Error(`Erro ao importar produtos: ${error.message}`);
      }

      await refreshContainers();
      setImportOpen(false);
      setPendingFile(null);
      setImportStatus('');
      navigate(`/produtos?container=${encodeURIComponent(container.id)}`);
      const imageCount = rows.reduce(
        (total, product) => total + Number(Boolean(product.img_path)) + Number(Boolean(product.img_path_secondary)),
        0,
      );
      notify(imageCount
        ? `Contêiner importado com ${rows.length} produtos e ${imageCount} imagens.`
        : `Contêiner importado com ${rows.length} produtos.`);
    } catch (error) {
      let message = error.message || String(error);
      if (containerId) {
        const cleanup = await supabase.from('containers').delete().eq('id', containerId);
        if (cleanup.error) {
          message += ` Não foi possível remover o contêiner incompleto: ${cleanup.error.message}`;
        } else {
          const failures = await removeImages(uploadedImagePaths);
          if (failures.length) message += ` Falha ao remover imagens enviadas: ${failures.join('; ')}`;
        }
      } else if (uploadedImagePaths.length) {
        const failures = await removeImages(uploadedImagePaths);
        if (failures.length) message += ` Falha ao remover imagens enviadas: ${failures.join('; ')}`;
      }
      setImportError(message);
    } finally {
      setImportBusy(false);
      setImportStatus('');
    }
  }

  function handleDragEnter(event) {
    if (event.target.closest?.('.image-drop')) return;
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDraggingFile(true);
  }

  function handleDragLeave(event) {
    if (event.target.closest?.('.image-drop')) return;
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDraggingFile(false);
    }
  }

  function handleDrop(event) {
    if (event.target.closest?.('.image-drop')) return;
    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDraggingFile(false);
    const file = event.dataTransfer.files[0];
    if (file) openImport(file);
  }

  return (
    <div
      className="app-shell"
      onDragEnter={handleDragEnter}
      onDragOver={event => {
        if (!event.target.closest?.('.image-drop') && Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault();
      }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="site-header">
        <Link className="brand" to="/produtos">
          <span className="brand-mark" aria-hidden="true">Z</span>
          <span>Preço e Margem</span>
        </Link>
        <nav className="main-nav" aria-label="Navegação principal">
          <Link
            className={`btn ghost${location.pathname === '/produtos' ? ' active' : ''}`}
            to="/produtos"
            aria-current={location.pathname === '/produtos' ? 'page' : undefined}
          >
            Produtos
          </Link>
          <button className="btn" type="button" onClick={() => setAddProductOpen(true)}>
            + Adicionar produto
          </button>
          <button className="btn" type="button" onClick={() => fileInput.current?.click()}>
            Importar contêiner
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) openImport(file);
              event.target.value = '';
            }}
          />
        </nav>
      </header>

      {notice && <p className={`notice ${notice.type}`} role="status">{notice.message}</p>}
      {loadError && <p className="notice error" role="alert">{loadError}</p>}

      <Routes>
        <Route path="/" element={<Navigate to="/produtos" replace />} />
        <Route path="/containers/:id" element={<LegacyContainerRedirect />} />
        <Route
          path="/produtos"
          element={
            <ProductsPage
              containers={containers}
              loadingContainers={loadingContainers}
              onContainersChanged={refreshContainers}
              onNotice={notify}
              addProductOpen={addProductOpen}
              onAddProductOpenChange={setAddProductOpen}
            />
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>

      {draggingFile && <div className="file-drop-hint">Solte a planilha para importar um contêiner</div>}
      {importOpen && pendingFile && (
        <ImportDialog
          file={pendingFile}
          busy={importBusy}
          error={importError}
          status={importStatus}
          onCancel={() => {
            setImportOpen(false);
            setPendingFile(null);
            setImportStatus('');
          }}
          onImport={importContainer}
        />
      )}
    </div>
  );
}
