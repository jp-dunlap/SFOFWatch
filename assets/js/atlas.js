/**
 * This script initializes an interactive choropleth map of the United States
 * using D3.js. It visualizes SFOF influence on a state-by-state basis and
 * allows users to click on a state to view a detailed report in a modal.
 *
 * Data Sources:
 * - sfofInfluenceData (inline object): Contains scores and report availability for each state.
 * - US Atlas TopoJSON: Fetched externally to provide geographical boundaries for each US state.
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- DATA ---
    const sfofInfluenceData = {
        "Alabama": { score: 3, actors: 3, laws: 1, hasReport: true },
        "Alaska": { score: 1, actors: 1, laws: 0, hasReport: true },
        "Arizona": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Arkansas": { score: 2, actors: 1, laws: 1, hasReport: true },
        "California": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Colorado": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Connecticut": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Delaware": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Florida": { score: 3, actors: 2, laws: 1, hasReport: true },
        "Georgia": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Hawaii": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Idaho": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Illinois": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Indiana": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Iowa": { score: 1, actors: 1, laws: 0, hasReport: true },
        "Kansas": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Kentucky": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Louisiana": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Maine": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Maryland": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Massachusetts": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Michigan": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Minnesota": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Mississippi": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Missouri": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Montana": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Nebraska": { score: 1, actors: 1, laws: 0, hasReport: true },
        "Nevada": { score: 1, actors: 1, laws: 0, hasReport: true },
        "New Hampshire": { score: 0, actors: 0, laws: 0, hasReport: false },
        "New Jersey": { score: 0, actors: 0, laws: 0, hasReport: false },
        "New Mexico": { score: 0, actors: 0, laws: 0, hasReport: false },
        "New York": { score: 0, actors: 0, laws: 0, hasReport: false },
        "North Carolina": { score: 1, actors: 1, laws: 0, hasReport: true },
        "North Dakota": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Ohio": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Oklahoma": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Oregon": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Pennsylvania": { score: 1, actors: 1, laws: 0, hasReport: true },
        "Rhode Island": { score: 0, actors: 0, laws: 0, hasReport: false },
        "South Carolina": { score: 2, actors: 1, laws: 1, hasReport: true },
        "South Dakota": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Tennessee": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Texas": { score: 3, actors: 2, laws: 1, hasReport: true },
        "Utah": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Vermont": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Virginia": { score: 0, actors: 0, laws: 0, hasReport: false },
        "Washington": { score: 0, actors: 0, laws: 0, hasReport: false },
        "West Virginia": { score: 2, actors: 1, laws: 1, hasReport: true },
        "Wisconsin": { score: 1, actors: 1, laws: 0, hasReport: true },
        "Wyoming": { score: 2, actors: 1, laws: 1, hasReport: true }
    };

    // --- DOM ELEMENT SELECTION ---
    const mapContainer = document.getElementById('map-container');
    const tooltip = d3.select("#tooltip");
    const modal = document.getElementById('report-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalOverlay = document.getElementById('modal-overlay');
    const mainContent = document.querySelector('main');

    // --- D3 MAP SETUP ---
    const svg = d3.select("#map-container").append("svg").attr("viewBox", `0 0 975 610`).attr("width", "100%").attr("height", "auto");
    const projection = d3.geoAlbersUsa().scale(1300).translate([487.5, 305]);
    const path = d3.geoPath().projection(projection);
    
    const colorScale = d3.scaleQuantize()
        .domain([0, 3])
        .range(["#374151", "#22d3ee", "#0ea5e9", "#0891b2"]);

    // --- LEGEND SETUP ---
    const legendLabels = {
        0: "No known SFOF affiliation",
        1: "SFOF member state",
        2: "SFOF member state with key actors or anti-ESG laws",
        3: "SFOF member state with multiple key actors and anti-ESG laws"
    };
    const legendContainer = d3.select("#legend-container");
    const legend = legendContainer.selectAll(".legend")
        .data(colorScale.range())
        .enter().append("div")
        .attr("class", "legend flex items-center space-x-2");

    legend.append("div")
        .style("width", "20px")
        .style("height", "20px")
        .style("border-radius", "50%")
        .style("background-color", d => d);

    legend.append("span")
        .text((d, i) => legendLabels[i])
        .attr("class", "text-gray-300 text-sm");

    // --- MODAL FUNCTIONS ---
    function showModal(stateName) {
        const stateSlug = stateName.toLowerCase().replace(/\s+/g, '-');
        const reportPath = `/reports/${stateSlug}/`;

        modalTitle.textContent = `State Dossier: ${stateName}`;
        modalContent.innerHTML = '<p class="text-center text-gray-400">Loading report...</p>';
        modal.classList.add('is-visible');
        mainContent.style.filter = 'blur(4px)';

        fetch(reportPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Report not found for ${stateName}. Status: ${response.status}`);
                }
                return response.text();
            })
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const reportContent = doc.querySelector('.report-content');

                if (reportContent) {
                    modalContent.innerHTML = reportContent.innerHTML;
                } else {
                    modalContent.innerHTML = `<p class="text-gray-400">Could not parse the report content for ${stateName}. The report might be malformed.</p>`;
                }
            })
            .catch(error => {
                console.error("Error fetching report:", error);
                modalContent.innerHTML = `<p class="text-gray-400">No detailed report is available for this state at this time. It has been identified as a member state, but the full dossier has not yet been compiled.</p>`;
            });
    }

    function hideModal() {
        modal.classList.remove('is-visible');
        mainContent.style.filter = 'none';
    }

    // --- EVENT LISTENERS ---
    closeModalBtn.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', hideModal);
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            hideModal();
        }
    });

    // --- MAP RENDERING ---
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
        const states = topojson.feature(us, us.objects.states);
        svg.append("g")
            .selectAll("path")
            .data(states.features)
            .enter().append("path")
            .attr("d", path)
            .attr("class", d => {
                const stateData = sfofInfluenceData[d.properties.name];
                return `state ${stateData && stateData.hasReport ? 'has-report' : ''}`;
            })
            .style("fill", d => {
                const stateData = sfofInfluenceData[d.properties.name];
                return stateData ? colorScale(stateData.score) : "#374151";
            })
            .attr("aria-label", d => {
                const stateData = sfofInfluenceData[d.properties.name];
                let label = d.properties.name;
                if (stateData) {
                    label += `, Influence Score: ${stateData.score}`;
                }
                return label;
            })
            .on("mouseover", (event, d) => {
                const stateData = sfofInfluenceData[d.properties.name];
                let tooltipHtml = `<div class="tooltip-title">${d.properties.name}</div>`;
                if (stateData) {
                    tooltipHtml += `
                        <div>Influence Score: ${stateData.score}</div>
                        <div>Key Actors: ${stateData.actors}</div>
                        <div>Anti-ESG Laws: ${stateData.laws}</div>
                    `;
                }
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(tooltipHtml)
                    .style("left", `${event.pageX + 15}px`)
                    .style("top", `${event.pageY - 28}px`);
            })
            .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0))
            .on("mousemove", (event) => tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 28}px`))
            .on("click", (event, d) => {
                const stateData = sfofInfluenceData[d.properties.name];
                if (stateData && stateData.hasReport) {
                    showModal(d.properties.name);
                }
            });
    }).catch(error => {
        console.error("Error loading map data:", error);
        mapContainer.innerHTML = `<p class="text-center text-red-400">Could not load map data.</p>`;
    });
});
