document.addEventListener('DOMContentLoaded', function() {
    // 1. Initialization and Container Setup
    const vizContainer = document.getElementById('network-container');
    if (!vizContainer) {
        console.error("Network container #network-container not found.");
        return;
    }

    const sidebar = document.getElementById('node-details');
    const filterContainer = document.getElementById('filter-container');
    // Capture initial sidebar content to restore it later
    const defaultSidebarHTML = sidebar ? sidebar.innerHTML : '';

    // Ensure D3 is loaded
    if (typeof d3 === 'undefined') {
        console.error("D3.js library not found.");
        vizContainer.innerHTML = `<div class="text-red-400 text-center p-8">Visualization library failed to load.</div>`;
        return;
    }

    // 2. Color Definitions (matching the project theme)
    const colors = {
        cyan: "#22d3ee",
        red: "#f87171",
        green: "#34d399",
        orange: "#fb923c",
        purple: "#a78bfa",
        yellow: "#facc15",
        gray: "#6b7280"
    };

    // Define scales, domains can be expanded dynamically if needed
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const edgeColorScale = d3.scaleOrdinal(d3.schemePaired);

    // Helper function for formatting text
    const formatText = (text) => (text || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // 3. Data Loading (from inlined window.networkData)
    if (!window.networkData || !window.networkData.nodes) {
        console.error("Error loading network data: Data not found or invalid in window.networkData.");
        vizContainer.innerHTML = `<div class="text-red-400 text-center p-8">Failed to load network data.</div>`;
        return;
    }

    const data = window.networkData;

    // Handle variations in data structure (prioritizing 'edges' as per original script, falling back to 'links')
    const dataLinks = data.edges || data.links || [];
    
    // Create copies of the data for simulation (D3 modifies the data in place)
    const links = dataLinks.map(d => ({...d}));
    const nodes = data.nodes.map(d => ({...d}));

    // Assign colors based on actual data types
    const nodeTypes = Array.from(new Set(nodes.map(d => d.type))).sort();
    const edgeTypes = Array.from(new Set(links.map(d => d.type))).sort();
    
    // Update color scales with specific colors if known types exist, otherwise use default scheme
    if (nodeTypes.includes("state_officer")) {
        colorScale.domain(["person", "corporation", "foundation", "dark_money_fund", "political_group", "state_officer", "other"])
                  .range([colors.purple, colors.orange, colors.green, colors.red, colors.yellow, colors.cyan, colors.gray]);
    } else {
        colorScale.domain(nodeTypes);
    }

    if (edgeTypes.includes("funding")) {
         edgeColorScale.domain(["funding", "sponsorship", "personnel", "membership", "official_action", "affiliation"])
                       .range([colors.green, colors.orange, colors.gray, colors.yellow, colors.red, colors.purple]);
    } else {
        edgeColorScale.domain(edgeTypes);
    }

    // Build Adjacency Map for efficient neighbor lookup during highlighting
    const adjacency = new Map();
    nodes.forEach(node => {
        if (!adjacency.has(node.id)) adjacency.set(node.id, new Set());
    });
    // Note: At this stage, link.source/target are IDs, not objects
    links.forEach(link => {
        const sourceId = link.source;
        const targetId = link.target;
        if (adjacency.has(sourceId)) adjacency.get(sourceId).add(targetId);
        if (adjacency.has(targetId)) adjacency.get(targetId).add(sourceId);
    });

    // 4. Dynamic Filter and Legend Generation (Populating #filter-container)
    if (filterContainer) {
        // --- Generate Legend (Node Types) ---
        const legendTitle = document.createElement('h4');
        legendTitle.textContent = "Entity Types:";
        legendTitle.className = "text-sm font-semibold text-white mr-6";
        filterContainer.appendChild(legendTitle);

        nodeTypes.forEach(type => {
            const legendItem = document.createElement('div');
            legendItem.className = 'flex items-center text-xs text-gray-400 mr-4';
            legendItem.innerHTML = `
                <div style="background-color: ${colorScale(type)};" class="w-3 h-3 rounded-full mr-2"></div>
                <span>${formatText(type)}</span>
            `;
            filterContainer.appendChild(legendItem);
        });

        // --- Generate Filters (Edge Types) ---
        const filterTitle = document.createElement('h4');
        filterTitle.textContent = "Connection Filters:";
        filterTitle.className = "text-sm font-semibold text-white ml-6 mr-4";
        filterContainer.appendChild(filterTitle);

        edgeTypes.forEach(type => {
            const filterLabel = document.createElement('label');
            // Uses CSS classes defined in network.html
            filterLabel.className = 'flex items-center text-xs text-gray-300 mr-4 filter-label';
            filterLabel.innerHTML = `
                <input type="checkbox" class="filter-checkbox mr-2" data-type="${type}" checked>
                <span style="color: ${edgeColorScale(type)};" class="font-medium">${formatText(type)}</span>
            `;
            filterContainer.appendChild(filterLabel);
        });
    }

    // 5. Visualization Dimensions and Setup
    // Calculate dynamic dimensions based on the container styling (defined in CSS)
    let width = vizContainer.offsetWidth;
    let height = vizContainer.offsetHeight;

    if (height === 0 || width === 0) {
        console.error("Network container dimensions are 0. Ensure CSS provides height (e.g., 70vh) and width.");
        // Fallback dimensions if CSS fails
        width = 1000; height = 800; 
    }

    // 6. Simulation Setup
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120).strength(0.9))
        .force("charge", d3.forceManyBody().strength(-450))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(25));

    // 7. SVG Creation and Zoom Setup
    // Create the SVG dynamically inside the container
    const svg = d3.select("#network-container").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", [0, 0, width, height])
        .attr("id", "network-svg");

    // Main group element (g) for visualization elements
    const g = svg.append("g");

    // Apply zoom behavior
    const zoomHandler = d3.zoom()
        .scaleExtent([0.2, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });
    svg.call(zoomHandler);
    
    // Add click listener to the SVG background to reset view
    svg.on("click", (event) => {
        // Check if the click was on the background (the SVG itself) and not a node/link
        if (event.target === svg.node()) {
            resetFocus();
        }
    });

    // 8. Visualization Update Function
    let link = g.append("g").attr("class", "links").selectAll(".link");
    let node = g.append("g").attr("class", "nodes").selectAll(".node");
    let selectedNode = null;

    function updateVisualization() {
        const activeFilters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.dataset.type);
        const filteredLinks = links.filter(d => activeFilters.includes(d.type));
        
        // --- Update Links ---
        // Use IDs for data binding key, handling that source/target might be objects after simulation starts
        link = link.data(filteredLinks, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        link.exit().remove();
        link = link.enter().append("line")
            .attr("class", "link") // Apply CSS class for styling and transitions
            .attr("stroke-width", 2)
            .merge(link)
            .attr("stroke", d => edgeColorScale(d.type));

        // --- Update Nodes (Initialize if empty) ---
        if (node.empty()) {
            node = node.data(nodes, d => d.id);
            
            const nodeEnter = node.enter().append("g")
                .attr("class", "node") // Apply CSS class
                .call(drag(simulation))
                .on("click", handleClick);

            nodeEnter.append("circle")
                .attr("r", 12)
                .attr("fill", d => colorScale(d.type));

            nodeEnter.append("text")
                .attr("class", "node-label") // Apply CSS class
                .attr("dy", "-1.5em") // Position above the node
                .text(d => d.name);

            node = nodeEnter.merge(node);
        }
        
        // --- Restart simulation ---
        simulation.nodes(nodes);
        simulation.force("link").links(filteredLinks);
        simulation.alpha(0.5).restart();
        
        // Reapply highlighting if a node is selected, as filters might have changed connections
        if (selectedNode) {
            // Check if the selected node still exists (though we don't filter nodes out in this implementation)
            if (nodes.find(n => n.id === selectedNode.id)) {
                highlightNetwork(selectedNode);
                showDetails(selectedNode); // Refresh details as visible connections might have changed
            } else {
                resetFocus();
            }
        }
    }

    // 9. Simulation Tick Handler
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);
        node
            .attr("transform", d => `translate(${d.x}, ${d.y})`);
    });

    // 10. Interaction Handlers

    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            // Pin nodes after drag by not nullifying fx/fy (optional behavior)
            // event.subject.fx = null;
            // event.subject.fy = null;
        }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    function handleClick(event, d) {
        event.stopPropagation(); // Prevent event bubbling to the SVG background
        
        selectedNode = d;
        showDetails(d);
        highlightNetwork(d);
    }

    // Reset visualization and sidebar to default state
    function resetFocus() {
        if (sidebar) {
            // Reset sidebar content to the initial instructional text
            sidebar.innerHTML = defaultSidebarHTML;
        }
        
        // Reset visualization highlighting using CSS classes
        svg.classed("network-faded", false);
        node.classed("highlighted", false);
        link.classed("highlighted", false);
        selectedNode = null;
    }

    // Apply the focus/fade effect centered on node d
    function highlightNetwork(d) {
        // Get neighbors from the pre-calculated map
        const neighbors = adjacency.get(d.id) || new Set();

        // Apply the fade effect to the whole SVG
        svg.classed("network-faded", true);

        // Apply highlight class to selected node and neighbors
        node.classed("highlighted", n => n.id === d.id || neighbors.has(n.id));
        
        // Apply highlight class to connected links (only visible links)
        link.classed("highlighted", l => {
            // Access source/target safely as they are objects after simulation starts
            return l.source.id === d.id || l.target.id === d.id;
        });
    }

    // Update the sidebar with details of the selected node
    function showDetails(d) {
        if (!sidebar) return;

        const activeFilters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.dataset.type);
        
        // Filter connections based on visibility and connection to the node
        const connections = links.filter(l => {
            // Use object references for source/target as simulation has started
            const isConnected = l.source.id === d.id || l.target.id === d.id;
            const isVisible = activeFilters.includes(l.type);
            return isConnected && isVisible;
        });

        // Helper to get the name and direction of the connected node
        const getConnectionDetails = (l) => {
            if (l.source.id === d.id) {
                return { direction: 'to', name: l.target.name };
            } else {
                return { direction: 'from', name: l.source.name };
            }
        };

        // Reconstruct the sidebar content entirely
        sidebar.innerHTML = `
             <h3 class="text-2xl font-lora text-cyan-400 mb-4 pb-2 border-b border-gray-700">${d.name}</h3>
             <div id="details-content" class="text-gray-300">
                <p class="text-sm font-bold mb-3" style="color: ${colorScale(d.type)}">
                    ${formatText(d.subtype || d.type)}
                </p>
                <p class="text-sm mb-4">${d.description || 'No description available.'}</p>
                
                <h4 class="text-lg font-lora text-gray-200 border-b border-gray-700 pb-1 mb-3 mt-6">Visible Connections (${connections.length})</h4>
                <ul class="text-sm text-gray-400 space-y-3 mt-3">
                    ${connections.map(l => {
                        const { direction, name } = getConnectionDetails(l);
                        return `
                        <li class="border-l-2 pl-3" style="border-color: ${edgeColorScale(l.type)}">
                            <strong class="capitalize text-gray-300" style="color: ${edgeColorScale(l.type)}">${formatText(l.type)}</strong>
                            <em>${direction}</em> ${name}
                            <div class="text-xs text-gray-500 mt-1">
                                ${l.details || ''} 
                                ${l.amount ? `($${l.amount.toLocaleString()} ${l.year ? 'in ' + l.year : ''})` : ''}
                            </div>
                        </li>
                        `;
                    }).join('')}
                    ${connections.length === 0 ? '<li class="text-gray-500 italic">No visible connections with current filters.</li>' : ''}
                </ul>
            </div>
        `;
    }

    // 11. Initialize Event Listeners and Visualization
    // Attach event listeners to dynamically generated checkboxes using event delegation
    if (filterContainer) {
        filterContainer.addEventListener('change', (event) => {
            if (event.target.classList.contains('filter-checkbox')) {
                updateVisualization();
            }
        });
    }

    // Initial render
    updateVisualization();
    
    // Handle window resize for responsiveness
    window.addEventListener('resize', () => {
        width = vizContainer.offsetWidth;
        height = vizContainer.offsetHeight;

        if (width > 0 && height > 0) {
            svg.attr("viewBox", [0, 0, width, height]);
            simulation.force("center", d3.forceCenter(width / 2, height / 2));
            simulation.alpha(0.3).restart();
        }
    });
});
