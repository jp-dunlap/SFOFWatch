document.addEventListener('DOMContentLoaded', function() {
    fetch('/_data/sfof_network.json')
        .then(response => response.json())
        .then(data => {
            const container = document.getElementById('network-visualization');
            const detailsPanel = document.getElementById('node-details-panel');
            const searchInput = document.getElementById('network-search');
            const filterCheckboxes = document.querySelectorAll('.filter-checkbox');

            const allNodesMaster = data.nodes.map(node => ({...node, label: node.name}));

            const nodes = new vis.DataSet(allNodesMaster);
            const edges = new vis.DataSet(data.edges);

            const networkData = { nodes, edges };
            
            const options = {
                nodes: { 
                  shape: 'dot',
                  size: 16 
                },
                physics: {
                    forceAtlas2Based: { gravitationalConstant: -26, centralGravity: 0.005, springLength: 230, springConstant: 0.18 },
                    maxVelocity: 146,
                    solver: 'forceAtlas2Based',
                    timestep: 0.35,
                    stabilization: { iterations: 150 }
                },
                groups: {
                    political_group: { color: { background: '#3b82f6', border: '#bfdbfe' }, size: 25 },
                    foundation: { color: { background: '#f97316', border: '#fed7aa' } },
                    dark_money_fund: { color: { background: '#8b5cf6', border: '#ddd6fe' } },
                    corporation: { color: { background: '#14b8a6', border: '#99f6e4' } },
                    person: { color: { background: '#22c55e', border: '#bbf7d0' }, size: 25 },
                    state_officer: { color: { background: '#ef4444', border: '#fecaca' }, size: 25 }
                }
            };

            const network = new vis.Network(container, networkData, options);

            // --- Event Listeners ---
            network.on('click', handleNodeClick);
            searchInput.addEventListener('input', updateNetworkView);
            filterCheckboxes.forEach(cb => cb.addEventListener('change', updateNetworkView));

            function handleNodeClick(properties) {
                const { nodes: clickedNodeIds } = properties;
                if (clickedNodeIds.length > 0) {
                    const clickedNodeData = nodes.get(clickedNodeIds[0]);
                    updateDetailsPanel(clickedNodeData);
                }
            }

            function updateDetailsPanel(node) {
                if (!node) {
                    detailsPanel.innerHTML = `<h3>Node Details</h3><p>Could not find node information.</p>`;
                    return;
                }
                let reportLink = '';
                if (node.report_file) {
                    reportLink = `<a href="/network-reports/${node.report_file}" target="_blank" class="report-link">View Full Dossier</a>`;
                }
                detailsPanel.innerHTML = `
                    <h3>${node.name}</h3>
                    <p><strong>Type:</strong> ${node.subtype || node.type || 'N/A'}</p>
                    <p>${node.description || 'No description available.'}</p>
                    ${reportLink}
                `;
            }

            function updateNetworkView() {
                const activeGroups = Array.from(filterCheckboxes)
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);

                // Use a DataView to efficiently show/hide nodes
                const nodesView = new vis.DataView(nodes, {
                  filter: node => activeGroups.includes(node.group)
                });
                network.setData({nodes: nodesView, edges: edges});

                const searchTerm = searchInput.value.toLowerCase().trim();
                const updates = [];
                const fadedColor = 'rgba(200, 200, 200, 0.2)';
                const visibleNodes = allNodesMaster.filter(node => activeGroups.includes(node.group));

                if (searchTerm) {
                    visibleNodes.forEach(node => {
                        const isMatch = node.label.toLowerCase().includes(searchTerm);
                        if (!isMatch) {
                            updates.push({ id: node.id, color: fadedColor, font: { color: fadedColor } });
                        } else {
                            updates.push({ id: node.id, color: null, font: { color: null } });
                        }
                    });
                } else {
                    // Reset all visible nodes when search is cleared
                    visibleNodes.forEach(node => {
                        updates.push({ id: node.id, color: null, font: { color: null } });
                    });
                }
                nodes.update(updates);
            }
        })
        .catch(error => {
            console.error('Error fetching or processing network data:', error);
            const container = document.getElementById('network-visualization');
            container.innerHTML = '<p style="color: red; padding: 1rem;">Failed to load network data. See console for details.</p>';
        });
});
