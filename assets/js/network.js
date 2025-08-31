document.addEventListener('DOMContentLoaded', function () {
  // Verify data is loaded from network.html
  if (!window.networkData || !window.networkData.nodes || !window.networkData.edges) {
    console.error('Network data not found or is invalid.');
    const container = document.getElementById('network-container');
    if (container) {
        const loader = container.querySelector('.loader');
        if(loader) loader.style.display = 'none';
        container.innerHTML = `<p class="text-red-400 text-center p-8">Error: Could not load network data.</p>`;
    }
    return;
  }

  const { nodes, edges } = window.networkData;

  // --- Core Setup ---
  const container = document.getElementById('network-container');
  const detailsPanel = document.getElementById('node-details');
  const loader = container.querySelector('.loader');

  const width = container.offsetWidth;
  const height = container.offsetHeight;

  const svg = d3.select(container).append('svg')
    .attr('viewBox', [0, 0, width, height])
    .attr('preserveAspectRatio', 'xMidYMid meet');
    
  // --- Adjacency Map for Highlighting ---
  const adjacency = new Map();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  edges.forEach(link => {
    adjacency.get(link.source).add(link.target);
    adjacency.get(link.target).add(link.source);
  });

  // --- Scales & Visuals ---
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  const radiusScale = d3.scaleSqrt().domain([1, 10]).range([8, 28]);
  const strokeScale = d3.scaleLinear().domain([1, 5]).range([1.5, 6]);

  // --- Force Simulation ---
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(edges).id(d => d.id).distance(120).strength(0.8))
    .force('charge', d3.forceManyBody().strength(-500))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => radiusScale(d.influence || 5) + 5))
    .on('tick', ticked);

  // --- SVG Element Groups ---
  const g = svg.append('g');
  let link = g.append('g').attr('class', 'links').selectAll('line');
  let node = g.append('g').attr('class', 'nodes').selectAll('g');

  // --- Tooltip ---
  const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('background', 'rgba(0, 0, 0, 0.75)')
    .style('color', 'white')
    .style('padding', '5px 10px')
    .style('border-radius', '5px')
    .style('opacity', 0)
    .style('pointer-events', 'none'); // Important so it doesn't block other mouse events

  // --- Initial Render Function ---
  function initializeDisplay() {
    link = link
      .data(edges, d => `${d.source.id}-${d.target.id}`)
      .join('line')
      .attr('class', 'link')
      .attr('stroke-width', d => strokeScale(d.strength || 1))
      .attr('stroke', '#666');

    node = node
      .data(nodes, d => d.id)
      .join(enter => {
        const gNode = enter.append('g').attr('class', 'node');

        gNode.append('circle')
          .attr('r', d => radiusScale(d.influence || 5))
          .attr('fill', d => colorScale(d.type));

        gNode.append('text')
          .text(d => d.name)
          .attr('x', d => radiusScale(d.influence || 5) + 5)
          .attr('y', 3)
          .attr('font-size', '12px')
          .attr('fill', '#ccc');
        
        return gNode;
      })
      .on('click', handleClick)
      .on('mouseover', handleMouseOver)
      .on('mouseout', handleMouseOut)
      .call(drag(simulation));

    detailsPanel.innerHTML = '<p class="text-gray-400 italic">Click a node to see its direct connections.</p>';
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

  // --- Interactivity Handlers ---
  function handleClick(event, d) {
    event.stopPropagation();
    
    const neighbors = adjacency.get(d.id);

    // Highlight logic
    node.classed('highlighted', n => n.id === d.id || neighbors.has(n.id));
    link.classed('highlighted', l => l.source.id === d.id || l.target.id === d.id);
    svg.classed('network-faded', true);
    
    // Details panel update
    const connections = edges.filter(l => l.source.id === d.id || l.target.id === d.id);
    detailsPanel.innerHTML = `
      <h3 class="text-xl font-bold text-cyan-400 mb-2">${d.name}</h3>
      <p class="text-sm font-semibold text-gray-400 mb-4">${d.subtype || d.type}</p>
      <p class="text-sm text-gray-300 mb-6">${d.description}</p>
      <h4 class="text-md font-bold text-gray-200 border-t border-gray-600 pt-4 mt-4">Connections (${connections.length})</h4>
      <ul class="mt-2 space-y-2">
        ${connections.map(l => {
            const otherNode = l.source.id === d.id ? l.target : l.source;
            return `<li class="text-sm text-gray-400"><strong class="text-gray-200">${formatText(l.type)}:</strong> ${otherNode.name}</li>`;
        }).join('')}
      </ul>
    `;
  }

  function handleMouseOver(event, d) {
    tooltip.transition().duration(200).style('opacity', .9);
    tooltip.html(d.name)
      .style('left', (event.pageX + 15) + 'px')
      .style('top', (event.pageY - 28) + 'px');
  }

  function handleMouseOut() {
    tooltip.transition().duration(500).style('opacity', 0);
  }

  function resetView() {
      svg.classed('network-faded', false);
      node.classed('highlighted', false);
      link.classed('highlighted', false);
      detailsPanel.innerHTML = '<p class="text-gray-400 italic">Click a node to see its direct connections.</p>';
  }

  svg.on('click', resetView);

  function formatText(text) {
      return (text || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // --- Drag & Zoom Handlers ---
  const zoomHandler = d3.zoom().on('zoom', (event) => g.attr('transform', event.transform));
  zoomHandler(svg);

  function drag(simulation) {
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
    return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
  }
  
  // --- Finalization ---
  simulation.on('end', () => {
    if (loader) loader.style.display = 'none';
  });

  initializeDisplay();
});
