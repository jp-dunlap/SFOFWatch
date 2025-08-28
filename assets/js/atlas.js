/**
 * This script initializes an interactive choropleth map of the United States
 * using Leaflet.js. It visualizes the status of anti-ESG legislation on a state-by-state basis.
 *
 * Data Sources:
 * - /_data/legislation.json: Automated data feed from the Netlify function.
 * - /assets/us-states.geojson: A static file containing the geographical boundaries for each US state.
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the Leaflet map, centered on the continental US.
    const map = L.map('mapid').setView([37.8, -96], 4);

    // Add the base tile layer from OpenStreetMap.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    /**
     * Returns a specific color based on the legislative status of a state.
     * @param {string} status - The overallStatus from the legislation data (e.g., 'Enacted', 'Pending').
     * @returns {string} A hex color code.
     */
    function getColor(status) {
        switch (status) {
            case 'Enacted': return '#006837'; // Dark Green
            case 'Pending': return '#b35806'; // Orange/Brown
            case 'Failed':  return '#756bb1'; // Purple
            default:        return '#d9d9d9'; // Gray for "No Action"
        }
    }

    // Asynchronously fetch both the legislative data and the GeoJSON shapefile.
    Promise.all([
        fetch('/_data/legislation.json').then(res => res.json()),
        fetch('/assets/us-states.geojson').then(res => res.json())
    ]).then(([legislationData, geojsonData]) => {

        const legislationStates = legislationData.states;

        // Merge the legislative data into the properties of the GeoJSON features.
        geojsonData.features.forEach(feature => {
            const stateAbbr = feature.properties.STUSPS; // Assumes the GeoJSON has a 'STUSPS' property for state abbreviation.
            const data = legislationStates[stateAbbr];
            
            if (data) {
                feature.properties.legislationStatus = data.overallStatus;
                feature.properties.bills = data.bills;
            } else {
                feature.properties.legislationStatus = 'No Action';
                feature.properties.bills = [];
            }
        });

        /**
         * Defines the style for each state layer based on its legislative status.
         * @param {Object} feature - The GeoJSON feature for a state.
         * @returns {Object} A Leaflet path style object.
         */
        function style(feature) {
            return {
                fillColor: getColor(feature.properties.legislationStatus),
                weight: 2,
                opacity: 1,
                color: 'white',
                fillOpacity: 0.7
            };
        }

        // --- Map Interaction Handlers ---

        function highlightFeature(e) {
            const layer = e.target;
            layer.setStyle({ weight: 5, color: '#666', dashArray: '', fillOpacity: 0.7 });
            layer.bringToFront();
        }

        function resetHighlight(e) {
            geojson.resetStyle(e.target);
        }

        function showPopup(e) {
            const layer = e.target;
            const props = layer.feature.properties;
            let content = `<h3>${props.NAME}</h3>`;
            content += `<p><strong>Status:</strong> ${props.legislationStatus}</p>`;

            if (props.bills && props.bills.length > 0) {
                content += `<h4>Relevant Bills (${props.bills.length}):</h4><ul>`;
                // Display up to 5 bills in the popup to keep it concise.
                props.bills.slice(0, 5).forEach(bill => {
                    content += `<li><a href="${bill.url}" target="_blank" rel="noopener noreferrer">${bill.number}</a>: ${bill.title} (Last Action: ${bill.last_action_date})</li>`;
                });
                if (props.bills.length > 5) {
                    content += `<li>...and ${props.bills.length - 5} more.</li>`;
                }
                content += `</ul>`;
            } else {
                content += `<p>No relevant anti-ESG bills tracked.</p>`;
            }

            layer.bindPopup(content).openPopup();
        }

        // Create the GeoJSON layer with styles and interactions.
        const geojson = L.geoJson(geojsonData, {
            style: style,
            onEachFeature: function(feature, layer) {
                layer.on({
                    mouseover: highlightFeature,
                    mouseout: resetHighlight,
                    click: showPopup
                });
            }
        }).addTo(map);

        // --- Map Legend ---
        const legend = L.control({position: 'bottomright'});
        legend.onAdd = function (map) {
            const div = L.DomUtil.create('div', 'info legend');
            const grades = ['Enacted', 'Pending', 'Failed', 'No Action'];
            div.innerHTML += '<h4>Anti-ESG Legislation Status</h4>';
            for (let i = 0; i < grades.length; i++) {
                div.innerHTML +=
                    '<i style="background:' + getColor(grades[i]) + '"></i> ' +
                    grades[i] + '<br>';
            }
            return div;
        };
        legend.addTo(map);

    }).catch(error => console.error("Error loading map data:", error));
});
