const axios = require('axios');

exports.handler = async function (event, context) {
    const targetUrl = event.queryStringParameters.url;

    if (!targetUrl) {
        return {
            statusCode: 400,
            body: 'URL parameter is missing.',
        };
    }

    try {
        const response = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': response.headers['content-type'],
            },
            body: response.data.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('Proxy Error:', error.message);
        return {
            statusCode: 500,
            body: `Failed to fetch the URL: ${error.message}`,
        };
    }
};
