export async function initMindMap() {
  const container = document.getElementById('mindmap-container');
  if (!container) return;

  const drawer = document.getElementById('mindmapDrawer');
  const drawerTitle = document.getElementById('mindmapDrawerTitle');
  const drawerContent = document.getElementById('mindmapDrawerContent');
  const drawerClose = document.getElementById('mindmapDrawerClose');

  function closeDrawer() {
    if (!drawer) return;
    drawer.setAttribute('hidden', '');
    if (drawerTitle) drawerTitle.textContent = 'File';
    if (drawerContent) drawerContent.textContent = '';
  }

  async function openVaultFile(nodeId) {
    if (!drawer || !drawerTitle || !drawerContent) return;
    const rel = String(nodeId || '');
    if (!rel.startsWith('obsidian_vault/')) return;
    const vaultPath = rel.replace(/^obsidian_vault\//, '');

    drawer.removeAttribute('hidden');
    drawerTitle.textContent = vaultPath;
    drawerContent.textContent = 'Loading…';

    try {
      const url = `/api/vault/${encodeURIComponent(vaultPath).replace(/%2F/g, '/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      drawerContent.textContent = data.content || '';
    } catch (e) {
      drawerContent.textContent = `Failed to load: ${vaultPath}`;
    }
  }

  drawerClose?.addEventListener('click', closeDrawer);
  closeDrawer();

  // Clear existing in case of re-render
  container.innerHTML = '';
  
  // Show loading
  const loading = document.createElement('div');
  loading.className = 'mindmap-loading';
  loading.textContent = 'Mapping Neural Network...';
  container.appendChild(loading);

  try {
    const res = await fetch('/api/vault/mindmap');
    const gData = await res.json();
    loading.remove();

    // Use ForceGraph from CDN (imported in index.html)
    const Graph = ForceGraph()(container)
      .graphData(gData)
      .backgroundColor('#0D0D0D')
      .nodeId('id')
      .nodeLabel('name')
      .nodeAutoColorBy('group')
      .nodeVal(node => Math.max(2, node.name.length * 0.5)) // Scale node size slightly by content depth
      .onNodeClick((node) => {
        if (!node || node.isDir) return;
        if (typeof node.id !== 'string') return;
        // Only open vault-backed markdown files for now
        if (node.id.startsWith('obsidian_vault/') && node.id.endsWith('.md')) {
          openVaultFile(node.id);
        }
      })
      .linkDirectionalParticles(2) // The "electrical synapses firing"
      .linkDirectionalParticleSpeed(d => 0.005 + Math.random() * 0.01)
      .linkDirectionalParticleWidth(1.5)
      .linkColor(() => 'rgba(255,255,255,0.2)')
      // Neon glow effect for nodes
      .nodeCanvasObject((node, ctx, globalScale) => {
        const label = node.name;
        const fontSize = 12/globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;

        // Draw node dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color || '#fff';
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = node.color || '#fff';

        // Draw text
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 0; // turn off glow for text to maintain readability
        ctx.fillText(label, node.x, node.y + 8);
      });

      // Simple zoom-in animation on boot
      Graph.d3Force('charge').strength(-120);
      
      // Auto-zoom to fit after a short layout calc
      setTimeout(() => {
        Graph.zoomToFit(400, 50);
      }, 1000);

  } catch (error) {
    console.error('Failed to load mindmap', error);
    loading.textContent = 'Error loading Mind Map.';
  }
}
