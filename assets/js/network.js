// assets/js/network.js

function initializeNetwork() {
    const vizContainer = document.getElementById('network-container');
    
    // Helper function to display initialization errors
    const displayError = (container, message, errorDetails = '') => {
        if (container) {
            console.error(message, errorDetails);
            // Ensure error message is visible even if container height is problematic
            container.innerHTML = `
                <div class="text-red-400 text-center p-8 h-full flex flex-col justify-center items-center">
                    <h2 class="text-xl font-bold">Visualization Error</h2>
                    <p>${message}</p>
                    ${errorDetails ? `<pre class="text-xs mt-4 text-left bg-gray-800 p-4 overflow-auto max-w-full">${errorDetails}</pre>` : ''}
                </div>`;
        } else {
            console.error("Fatal Error: Visualization container not found.", message, errorDetails);
        }
    };

    if (!vizContainer) {
        displayError(null, "Network container #network-container not found.");
        return;
    }

    // Ensure D3 is loaded
    if (typeof d3 === 'undefined') {
        displayError(vizContainer, "D3.js library failed to load.");
        return;
    }

    // Wrap the main visualization logic in a try...catch block to catch runtime errors
    try {
        renderNetworkVisualization(vizContainer, displayError);
    } catch (error) {
        displayError(vizContainer, "An unexpected error occurred during visualization initialization.", error.stack || error.message);
    }
}


function renderNetworkVisualization(vizContainer, displayError) {
    // 1. Initialization and Container Setup
    const sidebar = document.getElementById('node-details');
    const filterContainer = document.getElementById('filter-container');
    
    // Define the default HTML for the sidebar (used on initialization and reset)
    const getDefaultSidebarHTML = () => `
        <h3 class="text-2xl font-lora text-cyan-400 mb-4 pb-2 border-b border-gray-700">Connection Details</h3>
        <div id="details-scroll-container" class="text-gray-300">
             <p class="text-gray-500 italic">Click a node to view connections and highlight the network. Zoom and drag to explore. Click the background to reset.</p>
        </div>
    `;

    // Initialize sidebar content
    if (sidebar) {
        sidebar.innerHTML = getDefaultSidebarHTML();
    }

    // 2. Color Definitions
    const colors = {
        cyan: "#22d3ee",
        red: "#f87171",
        green: "#34d399",
        orange: "#fb923c",
        purple: "#a78bfa",
        yellow: "#facc15",
        gray: "#6b7280"
    };

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    const edgeColorScale = d3.scaleOrdinal(d3.schemePaired);

    // Helper function for formatting text (Robust version)
    const formatText = (text) => {
        try {
            return (String(text || '')).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        } catch (e) {
            return String(text);
        }
    };

    // 3. Data Loading and Validation
    if (!window.networkData || !window.networkData.nodes || !Array.isArray(window.networkData.nodes)) {
        displayError(vizContainer, "Error loading network data: Data not found, invalid, or nodes array missing.");
        return;
    }

    const data = window.networkData;
    const dataLinks = data.edges || data.links || [];
    
    if (!Array.isArray(dataLinks)) {
        displayError(vizContainer, "Error loading network data: Links/Edges data is not an array.");
        return;
    }

    // Create copies of the data for simulation
    const nodes = data.nodes.map(d => ({...d}));

    // --- CRITICAL VALIDATION: Ensure data integrity before D3 simulation ---
    const nodeIds = new Set();
    nodes.forEach(node => {
        if (node.id !== undefined && node.id !== null) {
            nodeIds.add(node.id);
        } else {
            console.warn("Node found without an ID:", node);
        }
    });
    
    // Filter links to ensure they connect valid nodes. D3 crashes if IDs are missing.
    const validLinks = dataLinks.filter(link => {
        const sourceId = link.source;
        const targetId = link.target;

        if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
            return true;
        } else {
            console.warn("Link references non-existent node ID(s), filtering out:", link);
            return false;
        }
    }).map(d => ({...d})); // Create copies after filtering
    // -----------------------------------------------------------------------


    // Assign colors based on actual data types
    const nodeTypes = Array.from(new Set(nodes.map(d => d.type))).filter(t => t).sort();
    // Use validLinks for edge types
    const edgeTypes = Array.from(new Set(validLinks.map(d => d.type))).filter(t => t).sort();
    
    // Update color scales
    if (nodeTypes.includes("state_officer")) {
        colorScale.domain(["person", "corporation", "foundation", "dark_money_fund", "political_group", "state_officer", "other"])
                  .range([colors.purple, colors.orange, colors.green, colors.red, colors.yellow, colors.cyan, colors.gray]);
    } else if (nodeTypes.length > 0) {
        colorScale.domain(nodeTypes);
    }

    if (edgeTypes.includes("funding")) {
         edgeColorScale.domain(["funding", "sponsorship", "personnel", "membership", "official_action", "affiliation"])
                       .range([colors.green, colors.orange, colors.gray, colors.yellow, colors.red, colors.purple]);
    } else if (edgeTypes.length > 0) {
        edgeColorScale.domain(edgeTypes);
    }

    // Build Adjacency Map (using validLinks)
    const adjacency = new Map();
    nodeIds.forEach(id => adjacency.set(id, new Set()));
    validLinks.forEach(link => {
        // Adjacency map population is safe as links are validated
        adjacency.get(link.source).add(link.target);
        adjacency.get(link.target).add(link.source);
    });


    // 4. Dynamic Filter and Legend Generation
    if (filterContainer) {
        filterContainer.innerHTML = ''; // Clear container first

        if (nodeTypes.length > 0) {
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
        }

        if (edgeTypes.length > 0) {
            // --- Generate Filters (Edge Types) ---
            const filterTitle = document.createElement('h4');
            filterTitle.textContent = "Connection Filters:";
            filterTitle.className = `text-sm font-semibold text-white mr-4 ${nodeTypes.length > 0 ? 'ml-6' : ''}`;
            filterContainer.appendChild(filterTitle);

            edgeTypes.forEach(type => {
                const filterLabel = document.createElement('label');
                filterLabel.className = 'flex items-center text-xs text-gray-300 mr-4 filter-label';
                filterLabel.innerHTML = `
                    <input type="checkbox" class="filter-checkbox mr-2" data-type="${type}" checked>
                    <span style="color: ${edgeColorScale(type)};" class="font-medium">${formatText(type)}</span>
                `;
                filterContainer.appendChild(filterLabel);
            });
        }
    }

    // 5. Visualization Dimensions and Setup
    let width = vizContainer.offsetWidth;
    let height = vizContainer.offsetHeight;

    // Robust check for container dimensions. The CSS fixes should prevent this, but this acts as a safety net.
    if (height <= 10 || width <= 10) {
        console.warn(`Network container dimensions are very small (${width}x${height}) at initialization. Using fallback.`);
        width = Math.max(width, 800); 
        height = Math.max(height, 600);
    }

    // 6. Simulation Setup (Use validLinks)
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(validLinks).id(d => d.id).distance(120).strength(0.9))
        .force("charge", d3.forceManyBody().strength(-450))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius(25));

    // 7. SVG Creation and Zoom Setup
    const svg = d3.select("#network-container").append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", [0, 0, width, height])
        .attr("id", "network-svg");

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
        if (event.target === svg.node()) {
            resetFocus();
        }
    });

    // 8. Visualization Update Function
    let link = g.append("g").attr("class", "links").selectAll(".link");
    let node = g.append("g").attr("class", "nodes").selectAll(".node");
    let selectedNode = null;

    function updateVisualization() {
        // Robust filter checking
        const activeFilters = edgeTypes.filter(type => {
            const checkbox = document.querySelector(`.filter-checkbox[data-type="${type}"]`);
            return checkbox ? checkbox.checked : true;
        });

        // Filter from the already validated links
        const filteredLinks = validLinks.filter(d => activeFilters.includes(d.type));
        
        // --- Update Links ---
        // Data binding key handles source/target as IDs (initial) or objects (after simulation)
        link = link.data(filteredLinks, d => `${d.source.id || d.source}-${d.target.id || d.target}`);
        link.exit().remove();
        link = link.enter().append("line")
            .attr("class", "link")
            .attr("stroke-width", 2)
            .merge(link)
            .attr("stroke", d => edgeColorScale(d.type));

        // --- Update Nodes (Initialize if empty) ---
        if (node.empty()) {
            node = node.data(nodes, d => d.id);
            
            const nodeEnter = node.enter().append("g")
                .attr("class", "node")
                .call(drag(simulation))
                .on("click", handleClick);

            nodeEnter.append("circle")
                .attr("r", 12)
                .attr("fill", d => colorScale(d.type));

            nodeEnter.append("text")
                .attr("class", "node-label")
                .attr("dy", "-1.5em") // Position above the node
                .text(d => d.name);

            node = nodeEnter.merge(node);
        }
        
        // --- Restart simulation ---
        simulation.nodes(nodes);
        simulation.force("link").links(filteredLinks);
        simulation.alpha(0.5).restart();
        
        // Reapply highlighting if a node is selected
        if (selectedNode) {
            if (nodes.find(n => n.id === selectedNode.id)) {
                highlightNetwork(selectedNode);
                showDetails(selectedNode);
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

    // 10. Interaction Handlers (Drag, Click, Highlight, Details)

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
            // Optional: Keep nodes pinned after drag (do not set fx/fy to null)
        }
        return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
    }

    function handleClick(event, d) {
        event.stopPropagation(); 
        selectedNode = d;
        showDetails(d);
        highlightNetwork(d);
    }

    function resetFocus() {
        if (sidebar) {
            sidebar.innerHTML = getDefaultSidebarHTML();
        }
        svg.classed("network-faded", false);
        node.classed("highlighted", false);
        link.classed("highlighted", false);
        selectedNode = null;
    }

    function highlightNetwork(d) {
        const neighbors = adjacency.get(d.id) || new Set();
        svg.classed("network-faded", true);
        node.classed("highlighted", n => n.id === d.id || neighbors.has(n.id));
        link.classed("highlighted", l => {
            // Source/target are objects after simulation starts
            return l.source.id === d.id || l.target.id === d.id;
        });
    }

    function showDetails(d) {
        if (!sidebar) return;

        const activeFilters = edgeTypes.filter(type => {
            const checkbox = document.querySelector(`.filter-checkbox[data-type="${type}"]`);
            return checkbox ? checkbox.checked : true;
        });
        
        // Filter connections (using validLinks)
        const connections = validLinks.filter(l => {
            const isConnected = l.source.id === d.id || l.target.id === d.id;
            const isVisible = activeFilters.includes(l.type);
            return isConnected && isVisible;
        });

        const getConnectionDetails = (l) => {
            if (l.source.id === d.id) {
                return { direction: 'to', name: l.target.name };
            } else {
                return { direction: 'from', name: l.source.name };
            }
        };

        // Reconstruct the sidebar content
        sidebar.innerHTML = `
             <h3 class="text-2xl font-lora text-cyan-400 mb-4 pb-2 border-b border-gray-700">${d.name || 'Unknown Entity'}</h3>
             <div id="details-scroll-container" class="text-gray-300">
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
                            <em>${direction}</em> ${name || 'Unknown'}
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


    // 12. Initialize Event Listeners and Visualization
    if (filterContainer) {
        filterContainer.addEventListener('change', (event) => {
            if (event.target.classList.contains('filter-checkbox')) {
                updateVisualization();
            }
        });
    }

    // Initial render
    if (nodes.length > 0) {
        updateVisualization();
    } else {
        displayError(vizContainer, "No nodes available in the data to visualize.");
    }

    
    // Handle window resize for responsiveness
    let resizeTimeout;
    window.addEventListener('resize', () => {
        // Debounce the resize event
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const newWidth = vizContainer.offsetWidth;
            const newHeight = vizContainer.offsetHeight;

            // Only update if dimensions are valid and have changed significantly
            if (newWidth > 10 && newHeight > 10 && (Math.abs(newWidth - width) > 5 || Math.abs(newHeight - height) > 5)) {
                width = newWidth;
                height = newHeight;
                
                svg.attr("viewBox", [0, 0, width, height]);
                simulation.force("center", d3.forceCenter(width / 2, height / 2));
                simulation.alpha(0.3).restart();
            }
        }, 150);
    });
}

// Robust initialization for deferred scripts
// Check the document's readyState. If it's already 'interactive' or 'complete', 
// DOMContentLoaded has already fired, so we run the initialization immediately.
if (document.readyState === 'loading') {
    // Loading hasn't finished yet
    document.addEventListener('DOMContentLoaded', initializeNetwork);
} else {
    // `DOMContentLoaded` has already fired
    initializeNetwork();
}
