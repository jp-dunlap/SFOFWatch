document.addEventListener('DOMContentLoaded', function() {
    const width = 960;
    const height = 600;
    const sidebar = document.getElementById('node-details');

    const colorScale = d3.scaleOrdinal()
        .domain(["person", "corporation", "foundation", "dark_money_fund", "political_group", "state_officer", "membership", "official_action"])
        .range(["#3b82f6", "#f97316", "#16a34a", "#dc2626", "#9333ea", "#65a30d"]);

    const edgeColorScale = d3.scaleOrdinal()
        .domain(["funding", "sponsorship", "personnel", "membership", "official_action"])
        .range(["#16a34a", "#f97316", "#3b82f6", "#65a30d", "#ef4444"]);

    // Create a legend
    const legendContainer = d3.select('#network-legend');
    const legend = legendContainer.selectAll(".legend-item")
        .data(colorScale.domain())
        .enter().append('div')
        .attr('class', 'legend-item');

    legend.append('div')
        .style('background-color', d => colorScale(d))
        .attr('class', 'legend-color-box');
    legend.append('span')
        .text(d => d.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

    // Fetch the data
    d3.json("/_data/sfof_network.json").then(data => {
        const links = data.edges.map(d => Object.create(d));
        const nodes = data.nodes.map(d => Object.create(d));

        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(200))
            .force("charge", d3.forceManyBody().strength(-500))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(25));

        const svg = d3.select("#network-svg")
            .attr("viewBox", [0, 0, width, height])
            .call(d3.zoom().scaleExtent([0.3, 5]).on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        const g = svg.append("g");
        let link = g.append("g").selectAll("line");
        let node = g.append("g").selectAll("g");

        function updateVisualization() {
            const activeFilters = Array.from(document.querySelectorAll('.filter-checkbox:checked')).map(cb => cb.dataset.type);
            const filteredLinks = links.filter(d => activeFilters.includes(d.type));

            link = link.data(filteredLinks, d => `${d.source.id}-${d.target.id}`);
            link.exit().remove();
            link = link.enter().append("line")
                .attr("stroke-width", 2)
                .merge(link)
                .attr("stroke", d => edgeColorScale(d.type))
                .attr("stroke-opacity", 0.7);

            node = node.data(nodes, d => d.id);
            node.exit().remove();
            const nodeEnter = node.enter().append("g")
                .call(drag(simulation))
                .on("click", showDetails)
                .on("mouseover", handleMouseOver)
                .on("mouseout", handleMouseOut);

            nodeEnter.append("circle")
                .attr("r", 12)
                .attr("stroke", "#fff")
                .attr("stroke-width", 1.5)
                .attr("fill", d => colorScale(d.type));

            nodeEnter.append("text")
                .attr("class", "node-label")
                .attr("x", 15)
                .attr("y", 4)
                .text(d => d.name)
                .style("display", "none");

            node = nodeEnter.merge(node);
            
            simulation.nodes(nodes);
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
                .attr("transform", d => `translate(${d.x}, ${d.y})`);
        });

        function drag(simulation) {
            function dragstarted(event) { if (!event.active) simulation.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; }
            function dragged(event) { event.subject.fx = event.x; event.subject.fy = event.y; }
            function dragended(event) { if (!event.active) simulation.alphaTarget(0); event.subject.fx = null; event.subject.fy = null; }
            return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
        }

        function handleMouseOver(event, d) {
            d3.select(this).select("text").style("display", "block");
        }

        function handleMouseOut(event, d) {
            d3.select(this).select("text").style("display", "none");
        }
        
        function showDetails(event, d) {
            node.selectAll("circle").attr("stroke", "#fff").attr("stroke-width", 1.5);
            d3.select(this).select("circle").attr("stroke", "#facc15").attr("stroke-width", 3);
            
            sidebar.innerHTML = `
                <h3 class="text-xl font-lora text-cyan-400 mb-2">${d.name}</h3>
                <p class="text-sm font-bold text-gray-400 mb-3">${d.subtype || ''}</p>
                <p class="text-gray-300 text-sm mb-4">${d.description}</p>
                <h4 class="text-lg font-lora text-gray-200 border-b border-gray-600 pb-1 mb-2">Connections</h4>
                <ul class="text-sm text-gray-400 space-y-2">
                    ${links.filter(l => l.source.id === d.id || l.target.id === d.id).map(l => `
                        <li>
                            <strong class="capitalize text-gray-300">${l.type.replace(/_/g, ' ')}:</strong>
                            ${l.source.id === d.id ? `<em>to</em> ${l.target.name}` : `<em>from</em> ${l.source.name}`}
                            <div class="text-xs pl-2 text-gray-500">${l.details || ''} ${l.amount ? `($${l.amount.toLocaleString()} in ${l.year})` : ''}</div>
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        document.querySelectorAll('.filter-checkbox').forEach(checkbox => checkbox.addEventListener('change', updateVisualization));
        updateVisualization();

    }).catch(error => console.error("Error loading network data:", error));
});
