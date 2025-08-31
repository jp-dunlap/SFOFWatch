document.addEventListener('DOMContentLoaded', function () {
  const { nodes, edges } = window.networkData;

  // --- Core Setup ---
  const container = document.getElementById('network-container');
  const detailsPanel = document.getElementById('node-details');
  const loader = container.querySelector('.loader');

  if (!container) {
    console.error('Network container not found.');
    return;
  }

  const width = container.offsetWidth;
  const height = container.offsetHeight;

  const svg = d3.select(container).append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // --- Scales & Visuals ---
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  const radiusScale = d3.scaleSqrt().domain([1, 10]).range([5, 25]);
  const strokeScale = d3.scaleLinear().domain([1, 5]).range([1, 5]);

  // --- Force Simulation ---
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .on('tick', ticked);

  // --- SVG Element Groups ---
  const g = svg.append('g');
  const link = g.append('g')
    .attr('class', 'links')
    .selectAll('line');
  const node = g.append('g')
    .attr('class', 'nodes')
    .selectAll('g');

  // --- Initial Render Function ---
  function initializeDisplay() {
    // Links
    link = link
      .data(edges)
      .enter().append('line')
      .attr('class', 'link')
      .attr('stroke-width', d => strokeScale(d.strength || 1))
      .attr('stroke', '#555');

    // Nodes
    node = node
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node');

    node.append('circle')
      .attr('r', d => radiusScale(d.influence || 5))
      .attr('fill', d => colorScale(d.type));

    node.append('text')
      .text(d => d.name)
      .attr('x', 6)
      .attr('y', 3)
      .attr('font-size', '10px')
      .attr('fill', '#ccc');

    // Add drag capabilities
    const dragHandler = d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);

    dragHandler(node);

    // Initial message in details panel
    detailsPanel.innerHTML = '<p class="text-gray-400">Click on a node to see details.</p>';
  }

  // --- Simulation Ticker ---
  function ticked() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('transform', d => `translate(${d.x},${d.y})`);
  }

  // --- Drag & Zoom Handlers ---
  const zoomHandler = d3.zoom()
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  zoomHandler(svg);

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  
  // --- Finalization ---
  simulation.on('end', () => {
      loader.style.display = 'none';
  });

  initializeDisplay();
});
