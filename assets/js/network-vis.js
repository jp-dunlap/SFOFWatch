(function() {
    // Initialize the visualization when the DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        // Ensure D3 is available
        if (typeof d3 === 'undefined') {
            console.error("D3.js is not loaded.");
            return;
        }
        initializeNetworkVisualization();
    });

    function initializeNetworkVisualization() {
        const container = d3.select("#network-container");
        if (container.empty()) return;

        const width = container.node().getBoundingClientRect().width;
        const height = container.node().getBoundingClientRect().height;

        // Retry if the container dimensions haven't settled yet (common in complex layouts)
        if (width === 0 || height === 0) {
             setTimeout(initializeNetworkVisualization, 200);
             return;
        }

        // Clear the container and append the SVG
        container.html('');
        const svg = container.append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width, height]);

        // Group for zoom/pan functionality
        const g = svg.append("g");

        // Data
        const data = getNetworkData();

        // Calculate node degree (connectivity) for dynamic sizing
        const degree = {};
        data.nodes.forEach(d => degree[d.id] = 0);
        // Calculate degree based on initial link structure (strings)
        data.links.forEach(l => {
            degree[l.source]++;
            degree[l.target]++;
        });

        // Define dynamic radius function
        const getRadius = (d) => 5 + (degree[d.id] || 0) * 2;

        // Initialize Simulation
        const simulation = d3.forceSimulation(data.nodes)
            .force("link", d3.forceLink(data.links).id(d => d.id).distance(120).strength(1))
            .force("charge", d3.forceManyBody().strength(-600))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1))
            // Prevent overlaps, accounting for dynamic radius and labels
            .force("collision", d3.forceCollide().radius(d => getRadius(d) + 15));

        // Draw Links
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(data.links)
            .enter().append("line")
            .attr("class", d => `link link-${d.type.replace(/\s+/g, '-')}`)
            .style("stroke", d => linkColor(d.type))
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

        // Circles (Dynamically sized)
        node.append("circle")
            .attr("r", getRadius)
            .attr("fill", d => d.color);

        // Labels
        node.append("text")
            .attr("class", "node-label")
            .attr("dy", d => -(getRadius(d) + 8)) // Position above the circle
            // Show labels only for highly connected or important nodes
            .text(d => (degree[d.id] > 3 || d.importance > 5) ? d.id : '');

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

        // Create adjacency list for highlighting neighbors (after D3 initializes links)
        const adjList = new Map();
        data.links.forEach(d => {
            if (!adjList.has(d.source.id)) adjList.set(d.source.id, []);
            if (!adjList.has(d.target.id)) adjList.set(d.target.id, []);
            adjList.get(d.source.id).push(d.target.id);
            adjList.get(d.target.id).push(d.source.id);
        });

        // --- Interaction Handlers (Focus/Fade) ---

        function nodeClicked(event, d) {
            event.stopPropagation(); // Prevent the background click handler from firing

            // 1. Update Sidebar
            updateSidebar(d, data.links);

            // 2. Apply Highlighting/Dimming
            svg.classed("network-faded", true);

            const neighbors = adjList.get(d.id) || [];

            // Highlight the clicked node and its neighbors
            node.classed("highlighted", n => n.id === d.id || neighbors.includes(n.id));
            
            // Highlight the connecting links
            link.classed("highlighted", l => l.source.id === d.id || l.target.id === d.id);
        }

        function resetHighlight(event) {
            // Only reset if clicking the SVG background itself
            if (event.target.tagName.toLowerCase() === 'svg') {
                svg.classed("network-faded", false);
                node.classed("highlighted", false);
                link.classed("highlighted", false);
                // Reset sidebar
                d3.select("#details-content").html('<p class="text-gray-500 italic">Click on a node in the network to see details. Click the background to reset the view.</p>');
            }
        }

        // --- Setup Zoom and Background Click ---
        const zoom = d3.zoom()
            .scaleExtent([0.5, 5])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        
        svg.call(zoom).on("click", resetHighlight);

        // Attach filter functionality
        setupFilters(svg);
    }

    // --- Helper Functions ---

    // Define link colors based on type
    const linkColor = (type) => {
        switch(type) {
            case "Funding": return "#3b82f6";          // Blue
            case "Sponsorship": return "#ef4444";      // Red
            case "Personnel": return "#22c55e";        // Green
            case "Membership": return "#a78bfa";       // Light Purple
            case "Official Action": return "#f97316";  // Orange
            default: return "#9ca3af";                 // Gray
        }
    };

    function updateSidebar(d, allLinks) {
        const detailsContent = d3.select("#details-content");
        
        // Find connections (D3 modifies links so source/target are objects)
        const connections = allLinks.filter(l => l.source.id === d.id || l.target.id === d.id);
        let connectionHtml = connections.map(c => {
            const otherNodeId = c.source.id === d.id ? c.target.id : c.source.id;
            return `<li><strong style="color:${linkColor(c.type)}">${c.type}:</strong> connected to ${otherNodeId}</li>`;
        }).join('');

        // Generate HTML for the sidebar
        detailsContent.html(`
            <h4 class="text-xl font-semibold text-white mt-4 mb-3">${d.id}</h4>
            <p class="mb-4 text-gray-300">${d.description || 'No description available.'}</p>
            <h5 class="text-lg text-cyan-400 mt-4 mb-2">Connections (${connections.length})</h5>
            <ul class="list-disc list-inside space-y-1 text-sm">
                ${connectionHtml || '<li>No connections found.</li>'}
            </ul>
        `);
    }

    // Standard D3 Drag functionality
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
            // Keep nodes where they are dragged for exploration (optional)
            // d.fx = null;
            // d.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    function setupFilters(svg) {
        d3.selectAll(".filter-checkbox").on("change", function() {
            const type = d3.select(this).attr("data-type");
            const checked = this.checked;
            const className = `.link-${type.replace(/\s+/g, '-')}`;

            // Toggle visibility of the links
            svg.selectAll(className)
               .style("display", checked ? null : 'none');
        });
    }

    // Data Source
    function getNetworkData() {
        // Expanded data for a richer visualization
        return {
            nodes: [
                { id: "SFOF", group: 1, color: "#8b5cf6", description: "The State Financial Officers Foundation. The central organizing body.", importance: 10 },
                { id: "SFOF Action (c4)", group: 1, color: "#8b5cf6", description: "501(c)(4) Lobbying Arm. Legally permitted to engage in unlimited lobbying and direct political campaign activities.", importance: 8 },
                // Funding (Blue)
                { id: "DonorsTrust", group: 2, color: "#3b82f6", description: "A major vehicle for anonymous conservative donations.", importance: 6 },
                { id: "Koch Industries", group: 2, color: "#3b82f6", description: "Multinational corporation involved in heavy political funding.", importance: 6 },
                { id: "Consumers Research", group: 2, color: "#3b82f6", description: "Advocacy group leading anti-ESG campaigns.", importance: 4 },
                // Sponsorship (Red)
                { id: "JP Morgan Chase", group: 3, color: "#ef4444", description: "Corporate sponsor of SFOF events.", importance: 3 },
                { id: "Wells Fargo", group: 3, color: "#ef4444", description: "Corporate sponsor of SFOF events.", importance: 3 },
                // Personnel/Affiliates (Green)
                { id: "ALEC", group: 4, color: "#22c55e", description: "American Legislative Exchange Council. Coordinates model legislation.", importance: 7 },
                { id: "Heartland Institute", group: 4, color: "#22c55e", description: "Think tank promoting climate skepticism.", importance: 4 },
                { id: "Heritage Foundation", group: 4, color: "#22c55e", description: "Major conservative think tank.", importance: 7 },
                // Membership (Purple variant)
                { id: "Riley Moore (WV)", group: 5, color: "#a78bfa", description: "Key SFOF member leading anti-ESG efforts.", importance: 6 },
                { id: "Marlo Oaks (UT)", group: 5, color: "#a78bfa", description: "Utah State Treasurer.", importance: 4 },
                // Official Action (Orange)
                { id: "BlackRock Divestment", group: 6, color: "#f97316", description: "Official state action to divest funds from BlackRock.", importance: 4 },
                { id: "Model Fiduciary Duty Act", group: 6, color: "#f97316", description: "Model legislation promoted by SFOF/ALEC.", importance: 5 },
            ],
            links: [
                { source: "SFOF", target: "SFOF Action (c4)", type: "Personnel" },
                { source: "SFOF", target: "DonorsTrust", type: "Funding" },
                { source: "DonorsTrust", target: "SFOF Action (c4)", type: "Funding" },
                { source: "Koch Industries", target: "DonorsTrust", type: "Funding" },
                { source: "SFOF", target: "Consumers Research", type: "Funding" },
                { source: "SFOF", target: "JP Morgan Chase", type: "Sponsorship" },
                { source: "SFOF", target: "Wells Fargo", type: "Sponsorship" },
                { source: "SFOF", target: "ALEC", type: "Personnel" },
                { source: "ALEC", target: "Model Fiduciary Duty Act", type: "Personnel" },
                { source: "Heritage Foundation", target: "Model Fiduciary Duty Act", type: "Personnel" },
                { source: "SFOF", target: "Heartland Institute", type: "Membership" },
                { source: "SFOF", target: "Heritage Foundation", type: "Membership" },
                { source: "SFOF", target: "Riley Moore (WV)", type: "Membership" },
                { source: "SFOF", target: "Marlo Oaks (UT)", type: "Membership" },
                { source: "Riley Moore (WV)", target: "BlackRock Divestment", type: "Official Action" },
                { source: "SFOF", target: "Model Fiduciary Duty Act", type: "Official Action" },
            ]
        };
    }

})();
