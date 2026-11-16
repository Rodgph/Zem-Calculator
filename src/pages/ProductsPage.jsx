import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContainerPage from './ContainerPage.jsx';
import { SKU_PREFIXES } from '../lib/sku.js';

export default function ProductsPage({
  containers,
  loadingContainers,
  onContainersChanged,
  onNotice,
  addProductOpen,
  onAddProductOpenChange,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const containerFilter = searchParams.get('container') || '';
  const [skuPrefix, setSkuPrefix] = useState('');
  const [codeOrder, setCodeOrder] = useState('asc');
  const containerId = containerFilter && containerFilter !== 'none' ? containerFilter : null;
  const productScope = containerId ? 'container' : containerFilter === 'none' ? 'unassigned' : 'all';

  function changeContainer(event) {
    const nextParams = new URLSearchParams(searchParams);
    if (event.target.value) nextParams.set('container', event.target.value);
    else nextParams.delete('container');
    setSearchParams(nextParams);
  }

  const filtersToolbar = (
    <section className="catalog-toolbar catalog-scope-toolbar">
      <label className="catalog-filter">
        Contêiner
        <select
          value={containerFilter}
          onChange={changeContainer}
          aria-label="Filtrar por contêiner"
        >
          <option value="">Todos</option>
          <option value="none">Sem contêiner</option>
          {containers.map(container => (
            <option key={container.id} value={container.id}>{container.nome}</option>
          ))}
        </select>
      </label>
      <label className="catalog-filter">
        Prefixo SKU
        <select
          value={skuPrefix}
          onChange={event => setSkuPrefix(event.target.value)}
          aria-label="Filtrar por prefixo do SKU"
        >
          <option value="">Todos os prefixos</option>
          {SKU_PREFIXES.map(prefix => (
            <option key={prefix} value={prefix}>{prefix}</option>
          ))}
        </select>
      </label>
      <label className="catalog-filter">
        Código
        <select
          value={codeOrder}
          onChange={event => setCodeOrder(event.target.value)}
          aria-label="Ordenar pelo código numérico do SKU"
        >
          <option value="asc">Menor para maior</option>
          <option value="desc">Maior para menor</option>
        </select>
      </label>
    </section>
  );

  return (
    <main className="products-hub">
      <ContainerPage
        key={`${productScope}:${containerId || ''}`}
        containers={containers}
        loadingContainers={loadingContainers}
        onContainersChanged={onContainersChanged}
        onNotice={onNotice}
        containerId={containerId}
        productScope={productScope}
        filtersToolbar={filtersToolbar}
        embedded
        skuPrefix={skuPrefix}
        codeOrder={codeOrder}
        addProductOpen={addProductOpen}
        onAddProductOpenChange={onAddProductOpenChange}
      />
    </main>
  );
}
