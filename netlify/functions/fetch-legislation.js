const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

exports.handler = async (event, context) => {
    const apiKey = process.env.LEGISCAN_API_KEY;
    const search_query = "ESG";
    const legislation_path = path.resolve(__dirname, '../../_data/legislation.json');

    if (!apiKey) {
        console.warn('LEGISCAN_API_KEY environment variable not set. Skipping data fetch.');
        return {
            statusCode: 200,
            body: 'Skipped legislation fetch due to missing API key.',
        };
    }

    const url = `https://api.legiscan.com/?key=${apiKey}&op=getSearch&q=${search_query}`;

    try {
        const response = await axios.get(url);

        if (response.data.status === 'ERROR') {
            console.error('LegiScan API returned an error:', response.data.alert.message);
            return {
                statusCode: 500,
                body: `LegiScan API Error: ${response.data.alert.message}`,
            };
        }
        
        // Check if the search results are present and not empty
        if (response.data.searchresult) {
            await fs.writeFile(legislation_path, JSON.stringify(response.data.searchresult, null, 2));
            console.log('Successfully fetched and updated legislation.json');
            return {
                statusCode: 200,
                body: 'Successfully updated legislation data.',
            };
        } else {
             console.log('No legislation data found for the query.');
             return {
                statusCode: 200,
                body: 'No legislation data found for the query.',
            };
        }
    } catch (error) {
        console.error('Error fetching legislation data:', error.message);
        // Don't fail the build, but log the error
        return {
            statusCode: 200, // Return a 200 so as not to fail the build process
            body: `Error fetching legislation data: ${error.message}. Using cached data.`,
        };
    }
};
