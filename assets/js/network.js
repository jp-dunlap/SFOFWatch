document.addEventListener('DOMContentLoaded', function() {
    const width = 960;
    const height = 600;
    const sidebar = document.getElementById('node-details');

    // Define colors based on node type
    const colorScale = d3.scaleOrdinal()
        .domain(["person", "corporation", "foundation", "dark_money_fund", "political_group", "state_officer"])
        .range(["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"]);

    // Define styles for edge types
    const edgeStyles = {
        funding: { stroke: "#2ca02c", opacity: 0.8, strokeWidth: 2.5 },
        sponsorship: { stroke: "#ff7f0e", opacity: 0.7, strokeWidth: 2 },
        personnel: { stroke: "#1f77b4", opacity: 0.6, strokeWidth: 1, dasharray: "5,5" },
        official_action: { stroke: "#d62728", opacity: 0.8, strokeWidth: 2 }
    };

    // Fetch the data
    d3.json("/_data/sfof_network.json").then(data => {
        // Initialize data structures (D3 modifies these in place)
        const links = data.edges.map(d => Object.create(d));
        const nodes = data.nodes.map(d => Object.create(d));

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(15));

        const svg = d3.select("#network-svg")
            .attr("viewBox", [0, 0, width, height])
            .call(d3.zoom().scaleExtent([0.5, 4]).on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        const g = svg.append("g");

        // Initialize links (edges) and nodes using D3 selections
        let link = g.append("g").selectAll("line");
        let node = g.append("g").selectAll("circle");

        function updateVisualization() {
            const activeFilters = getActiveFilters();
            const filteredLinks = links.filter(d => activeFilters.includes(d.type));

            // Update links using D3 join pattern (Enter/Update/Exit)
            link = link.data(filteredLinks, d => d.source.id + "-" + d.target.id);
            link.exit().remove();
            link = link.enter().append("line")
                .attr("stroke", d => edgeStyles[d.type]?.stroke || "#999")
                .attr("stroke-opacity", d => edgeStyles[d.type]?.opacity || 0.6)
                .attr("stroke-width", d => edgeStyles[d.type]?.strokeWidth || 1)
                .attr("stroke-dasharray", d => edgeStyles[d.type]?.dasharray || null)
                .merge(link);

            // Update nodes (only initialize once)
            if (node.empty()) {
                node = node.data(nodes, d => d.id)
                    .enter().append("circle")
                    .attr("r", 10)
                    .attr("fill", d => colorScale(d.type))
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1.5)
                    .call(drag(simulation))
                    .on("click", showDetails);

                node.append("title").text(d => d.name);
            }

            // Restart simulation with updated links
            simulation.force("link").links(filteredLinks);
            simulation.alpha(1).restart();
        }

        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
        });

        // Drag functionality
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
                event.subject.fx = null;
                event.subject.fy = null;
            }
            return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
        }

        // Show details in sidebar
        function showDetails(event, d) {
            // Highlight selected node
            node.attr("stroke", "#fff").attr("stroke-width", 1.5);
            d3.select(this).attr("stroke", "#000").attr("stroke-width", 3);

            sidebar.innerHTML = `
                <h3>${d.name}</h3>
                <p><strong>Type:</strong> ${d.type} (${d.subtype || 'N/A'})</p>
                ${d.state ? `<p><strong>State:</strong> ${d.state}</p>` : ''}
                <p>${d.description}</p>
                <h4>Connections:</h4>
                <ul>
                    ${links.filter(l => l.source.id === d.id || l.target.id === d.id).map(l => `
                        <li>
                            <strong>${l.type}:</strong>
                            ${l.source.id === d.id ? `To ${l.target.name}` : `From ${l.source.name}`}
                            <br><em>${l.details || ''} ${l.amount ? `($${l.amount.toLocaleString()})` : ''}</em>
                            ${l.citation_url ? `<a href="${l.citation_url}" target="_blank">[Citation]</a>` : ''}
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        // Filter handling
        const checkboxes = document.querySelectorAll('.filter-checkbox');
        checkboxes.forEach(checkbox => checkbox.addEventListener('change', updateVisualization));

        function getActiveFilters() {
            return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.dataset.type);
        }

        // Initial visualization render
        updateVisualization();

    }).catch(error => console.error("Error loading network data:", error));
});
