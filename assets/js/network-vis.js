(function() {
    // Enhanced Logging: Explicitly log every step to the browser console.
    console.log("[SFOF Network] 1. Script loaded and executing.");

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
        console.log("[SFOF Network] 2. DOMContentLoaded fired.");
        if (typeof d3 === 'undefined') {
            console.error("[SFOF Network] ERROR: D3.js is not loaded.");
            displayError("Critical Error: D3.js library not found. Check the script tag in network.html.");
            return;
        }
        console.log("[SFOF Network] 3. D3.js confirmed loaded.");

        try {
            initializeModal();
            // Start the robust initialization sequence
            checkReadinessAndInitialize();
        } catch (error) {
            console.error("[SFOF Network] Error during initial setup:", error);
            displayError("An unexpected error occurred during setup. Check the browser console for details.");
        }
    });

    // Helper to display errors within the container
    function displayError(message) {
        const container = d3.select("#network-container");
        if (!container.empty()) {
             container.html(`<div class="text-center text-red-500 p-10 border border-red-700 bg-red-900/30 m-4 rounded-lg">
                    <h3 class="text-xl font-bold">Visualization Error</h3>
                    <p class="mt-2">${message}</p>
                </div>`);
        }
    }

    // Robust Initialization: Wait for layout to settle before fetching data
    function checkReadinessAndInitialize(retryCount = 0) {
        const container = document.getElementById('network-container');
        if (!container) {
            console.error("[SFOF Network] ERROR: #network-container element not found in HTML.");
            return;
        }

        // Add loading indicator
        if (retryCount === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 p-10">Initializing visualization...</p>';
        }

        // Check if the container has dimensions (use a small threshold, e.g., 50px)
        const rect = container.getBoundingClientRect();
        if (rect.width < 50 || rect.height < 50) {
            // Layout not ready or container is too small
            if (retryCount > 10) { // Timeout after ~2 seconds
                console.error("[SFOF Network] ERROR: Container layout failed to stabilize after multiple attempts.");
                displayError("Visualization container failed to initialize (dimensions are too small). Check CSS styles for #network-container.");
                return;
            }
            console.log(`[SFOF Network] 4. Container layout not ready (Retry ${retryCount}), waiting...`);
            setTimeout(() => checkReadinessAndInitialize(retryCount + 1), 200);
            return;
        }
        // Layout is ready, now fetch data.
        console.log(`[SFOF Network] 4. Container ready. Dimensions: ${rect.width}w x ${rect.height}h.`);
        fetchNetworkData();
   }

    // Load the data from the external JSON file
    function fetchNetworkData() {
        const dataPath = "/assets/data/network-data.json";
        console.log(`[SFOF Network] 5. Attempting to fetch data from ${dataPath}`);
        
        d3.json(dataPath).then(data => {
            console.log("[SFOF Network] 6. Data successfully fetched. Nodes:", data.nodes.length, "Links:", data.links.length);
            try {
                initializeNetworkVisualization(data);
            } catch (error) {
                console.error("[SFOF Network] Error during visualization rendering:", error);
                displayError("An error occurred while rendering the visualization. Check the browser console.");
            }
        }).catch(error => {
            // This block executes if the JSON file cannot be found (404) or is invalid
            console.error("[SFOF Network] ERROR fetching network data:", error);
            displayError(`CRITICAL ERROR: Failed to load network data from <code>${dataPath}</code>. This indicates the file is missing on the server. Ensure your Eleventy configuration (<code>.eleventy.js</code>) is correctly copying the 'assets' directory.`);
        });
    }

    function initializeNetworkVisualization(data) {
        console.log("[SFOF Network] 7. Starting visualization rendering.");
        const container = d3.select("#network-container");
        
        // Dimensions are guaranteed to be ready
        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;

        // Prepare data: Calculate node degree (connectivity)
        const degree = {};
        data.nodes.forEach(d => degree[d.id] = 0);

        // Data integrity check: Filter links connecting to non-existent nodes
        const validNodeIds = new Set(data.nodes.map(n => n.id));
        const filteredLinks = data.links.filter(l => {
            if (!validNodeIds.has(l.source) || !validNodeIds.has(l.target)) {
                console.warn(`[SFOF Network] Data Integrity Issue: Link references non-existent node. Source: ${l.source}, Target: ${l.target}. Skipping link.`);
                return false;
            }
            return true;
        });

        // Calculate degree based on filtered links
        filteredLinks.forEach(l => {
            degree[l.source]++;
            degree[l.target]++;
        });

        const getRadius = (d) => {
            const base = 5;
            const scale = 1.5;
            return base + (degree[d.id] || 0) * scale;
        };

        // Setup SVG and Zoom/Pan functionality
        container.html(''); // Clear container (including loading messages/errors)
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

        // Initialize Simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(filteredLinks).id(d => d.id).distance(100).strength(0.8))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05))
            .force("collision", d3.forceCollide().radius(d => getRadius(d) + 20).strength(0.7));

        // Draw Links
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(filteredLinks)
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
        filteredLinks.forEach(d => {
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
            updateSidebar(d, filteredLinks);

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
        setupFilters(svg, filteredLinks);
        console.log("[SFOF Network] 8. Visualization rendering complete.");
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

        if (!modal || !mainContent) {
            console.warn("[SFOF Network] Modal or Main Content elements not found. Modal functionality disabled.");
            return;
        }

        // Define hideModal function
        function hideModal() {
            modal.classList.remove('is-visible');
            if (mainContent) mainContent.style.filter = 'none';
        }

        // Expose showModal globally so the sidebar button can access it
        window.showModal = function(nodeId, reportFile) {
            const reportPath = `/network-reports/${reportFile}`;
            console.log(`[SFOF Network] Modal: Fetching ${reportPath}`);

            modalTitle.textContent = `Dossier: ${nodeId}`;
            modalContent.innerHTML = `<p class="text-gray-500">Loading detailed dossier...</p>`;
            modal.classList.add('is-visible');
            if (mainContent) mainContent.style.filter = 'blur(4px)';

            fetch(reportPath)
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}. This indicates the report snippet is missing on the server. Ensure Eleventy is copying the 'network-reports' folder.`);
                    return response.text();
                })
                .then(html => {
                    modalContent.innerHTML = html;
                })
                .catch(error => {
                    console.error("[SFOF Network] ERROR fetching report:", error);
                    modalContent.innerHTML = `<p class="text-red-500">Failed to load detailed report for ${nodeId}. Check console for details. ${error.message}</p>`;
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
            // "Pin" nodes where they are dragged (optional)
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
        if (filterContainer.empty()) return;

        // Clear filters before adding them (prevents duplication if initialization runs twice)
        filterContainer.html('');

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
