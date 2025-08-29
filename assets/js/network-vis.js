(function() {
    // Configuration for visualization aesthetics
    const NODE_COLORS = {
        1: "#8b5cf6", // Core Network (Purple)
        2: "#f59e0b", // Funders/DAFs (Amber)
        3: "#10b981", // Corporations/Sponsors (Green)
        4: "#22d3ee", // Individuals/Officials (Cyan - Site Primary)
        5: "#ef4444", // Targets (Red)
        6: "#64748b"  // Legislation/Actions (Gray)
    };

    const LINK_COLORS = {
        "Funding": "#f59e0b",
        "Sponsorship": "#10b981",
        "Membership": "#22d3ee",
        "Affiliation": "#8b5cf6",
        "Operational": "#64748b",
        "Personnel": "#22d3ee",
        "Political Action": "#ef4444",
        "Beneficiary": "#10b981"
    };

    // Global variables for modal elements
    let modal, modalTitle, modalContent, mainContent;

    // Initialize when the DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof d3 === 'undefined') {
            console.error("D3.js is not loaded.");
            return;
        }
        initializeModal();
        fetchNetworkData();
    });

    // Load the data from the external JSON file
    function fetchNetworkData() {
        d3.json("/assets/data/network-data.json").then(data => {
            initializeNetworkVisualization(data);
        }).catch(error => {
            console.error("Error loading network data:", error);
            d3.select("#network-container").html('<p class="text-center text-red-400 p-10">Failed to load network data. Ensure /assets/data/network-data.json exists and is accessible.</p>');
        });
    }

    function initializeNetworkVisualization(data) {
        const container = d3.select("#network-container");
        if (container.empty()) return;

        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;

        // Handle potential race condition where layout hasn't settled
        if (width === 0 || height === 0) {
             setTimeout(() => initializeNetworkVisualization(data), 200);
             return;
        }

        // Prepare data: Calculate node degree (connectivity)
        const degree = {};
        data.nodes.forEach(d => degree[d.id] = 0);
        // Calculate degree based on initial link structure (strings before simulation initialization)
        data.links.forEach(l => {
            degree[l.source]++;
            degree[l.target]++;
        });

        const getRadius = (d) => {
            const base = 5;
            const scale = 1.5;
            return base + (degree[d.id] || 0) * scale;
        };

        // Setup SVG and Zoom/Pan functionality
        container.html('');
        const svg = container.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width, height]);

        const g = svg.append("g"); // Group for applying zoom transform

        const zoom = d3.zoom()
            .scaleExtent([0.3, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        
        svg.call(zoom); // Attach zoom behavior

        // Initialize Simulation with optimized forces
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(100).strength(0.8))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05))
            .force("collision", d3.forceCollide().radius(d => getRadius(d) + 20).strength(0.7));

        // Draw Links
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("class", d => `link link-${d.type.replace(/\s+/g, '-')}`)
            .style("stroke", d => LINK_COLORS[d.type] || "#9ca3af")
            .style("stroke-width", 1.5);

        // Draw Nodes
        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(data.nodes)
            .enter().append("g")
            .attr("class", "node")
            .call(drag(simulation))
            .on("click", nodeClicked);

        // Circles
        node.append("circle")
            .attr("r", getRadius)
            .attr("fill", d => NODE_COLORS[d.group] || "#cccccc");

        // Labels
        node.append("text")
            .attr("class", "node-label")
            .attr("dy", d => -(getRadius(d) + 5))
            // Show labels only for highly connected or important nodes
            .text(d => (d.importance > 6 || degree[d.id] > 5) ? d.id : '');

        // Simulation Tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Create adjacency list for highlighting (Post-simulation initialization)
        const adjList = new Map();
        data.links.forEach(d => {
            // D3 converts source/target strings to objects here
            if (!adjList.has(d.source.id)) adjList.set(d.source.id, []);
            if (!adjList.has(d.target.id)) adjList.set(d.target.id, []);
            adjList.get(d.source.id).push(d.target.id);
            adjList.get(d.target.id).push(d.source.id);
        });

        // --- Interaction Handlers (Focus/Fade and Sidebar) ---

        function nodeClicked(event, d) {
            event.stopPropagation(); 

            // 1. Update Sidebar (Includes button to open modal if report exists)
            updateSidebar(d, data.links);

            // 2. Apply Highlighting/Dimming (Focus/Fade effect)
            svg.classed("network-faded", true);

            const neighbors = adjList.get(d.id) || [];
            node.classed("highlighted", n => n.id === d.id || neighbors.includes(n.id));
            link.classed("highlighted", l => l.source.id === d.id || l.target.id === d.id);
        }

        function resetHighlight(event) {
             // Only reset if clicking the SVG background itself
             if (event.target.tagName.toLowerCase() === 'svg') {
                svg.classed("network-faded", false);
                node.classed("highlighted", false);
                link.classed("highlighted", false);
                // Reset sidebar
                d3.select("#details-content").html('<p class="text-gray-500 italic">Click a node to view connections and highlight the network. Zoom and drag to explore. Click the background to reset.</p>');
            }
        }

        svg.on("click", resetHighlight);

        // Setup dynamic filters
        setupFilters(svg, data.links);
    }

    // --- Sidebar Update ---
    function updateSidebar(d, allLinks) {
        const detailsContent = d3.select("#details-content");
        
        // Generate connections list
        const connectionsHtml = generateConnectionsHtml(d, allLinks);

        // Check if a detailed report exists and add button
        let dossierButtonHtml = '';
        if (d.report_file) {
            // Use window.showModal to call the modal function
            dossierButtonHtml = `<button onclick="window.showModal('${d.id}', '${d.report_file}')" class="mt-4 mb-4 w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-4 rounded transition duration-300 ease-in-out">
                                    View Full Dossier
                                 </button>`;
        }

        // Generate HTML for the sidebar
        detailsContent.html(`
            <h4 class="text-xl font-semibold text-white mt-4 mb-3">${d.id}</h4>
            <p class="text-sm text-gray-500 mb-3">Type: ${d.type || 'N/A'}</p>
            ${dossierButtonHtml}
            ${connectionsHtml}
        `);
    }

     function generateConnectionsHtml(d, allLinks) {
        // D3 ensures source/target are objects here
        const connections = allLinks.filter(l => l.source.id === d.id || l.target.id === d.id);
        let listHtml = connections.map(c => {
            const otherNodeId = c.source.id === d.id ? c.target.id : c.source.id;
            // Include details or financial values if present
            const detail = c.detail ? ` (${c.detail})` : (c.value ? ` ($${c.value.toLocaleString()})` : '');
            return `<li><strong style="color:${LINK_COLORS[c.type] || '#9ca3af'}">${c.type}:</strong> connection to ${otherNodeId}${detail}</li>`;
        }).join('');

        return `<h5 class="text-lg text-cyan-400 mt-4 mb-2">Connections (${connections.length})</h5>
                <ul class="list-disc list-inside space-y-1 text-sm">${listHtml || '<li>No connections found.</li>'}</ul>`;
    }


    // --- Modal Functions ---
    function initializeModal() {
        // Cache modal elements
        modal = document.getElementById('report-modal');
        modalTitle = document.getElementById('modal-title');
        modalContent = document.getElementById('modal-content');
        mainContent = document.getElementById('main-content'); // The target for blurring
        const closeModalBtn = document.getElementById('close-modal-btn');
        const modalOverlay = document.getElementById('modal-overlay');

        // Define hideModal function
        function hideModal() {
            modal.classList.remove('is-visible');
            if (mainContent) mainContent.style.filter = 'none';
            // Do NOT reset visualization highlights here; that is handled by the SVG click handler
        }

        // Expose showModal globally so the sidebar button can access it
        window.showModal = function(nodeId, reportFile) {
            const reportPath = `/network-reports/${reportFile}`;
            modalTitle.textContent = `Dossier: ${nodeId}`;
            modalContent.innerHTML = `<p class="text-gray-500">Loading detailed dossier...</p>`;
            modal.classList.add('is-visible');
            if (mainContent) mainContent.style.filter = 'blur(4px)';

            fetch(reportPath)
                .then(response => {
                    if (!response.ok) throw new Error('Report file not found on server.');
                    return response.text();
                })
                .then(html => {
                    modalContent.innerHTML = html;
                })
                .catch(error => {
                    console.error("Error fetching report:", error);
                    modalContent.innerHTML = `<p class="text-red-500">Failed to load detailed report for ${nodeId}.</p>`;
                });
        }

        // Attach event listeners
        if (closeModalBtn) closeModalBtn.addEventListener('click', hideModal);
        if (modalOverlay) modalOverlay.addEventListener('click', hideModal);
        
        document.addEventListener('keydown', (event) => {
            if (event.key === "Escape") {
                hideModal();
            }
        });
    }

    // --- Helper Functions (Drag and Filters) ---

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
            // "Pin" nodes where they are dragged for easier exploration
            // d.fx = null;
            // d.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    // Dynamically generate filters based on data
    function setupFilters(svg, links) {
        const filterContainer = d3.select("#filter-container");
        // Get unique link types from data
        const linkTypes = [...new Set(links.map(l => l.type))].sort();

        linkTypes.forEach(type => {
            const label = filterContainer.append("label")
                .attr("class", "flex items-center space-x-3 filter-label text-gray-300");

            label.append("input")
                .attr("type", "checkbox")
                .attr("class", "filter-checkbox")
                .attr("data-type", type)
                .property("checked", true)
                .on("change", function() {
                    const checked = this.checked;
                    const className = `.link-${type.replace(/\s+/g, '-')}`;
                    // Toggle visibility of links
                    svg.selectAll(className)
                       .style("display", checked ? null : 'none');
                });
            
            // Add a visual color swatch for the filter key
            label.append("span")
                .style("width", "12px")
                .style("height", "12px")
                .style("background-color", LINK_COLORS[type] || "#9ca3af")
                .style("border-radius", "3px");

            label.append("span").text(type);
        });
    }

})();
