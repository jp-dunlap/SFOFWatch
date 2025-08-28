const axios = require('axios');
const { Octokit } = require('@octokit/rest');

exports.handler = async function(event, context) {
  const LEGISCAN_API_KEY = process.env.LEGISCAN_API_KEY;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // You will need to add this to Netlify as well
  const GITHUB_REPO = 'jp-dunlap/sfofwatch'; // Your repository

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const [owner, repo] = GITHUB_REPO.split('/');

  try {
    // Fetch data from LegiScan API
    const response = await axios.get(`https://api.legiscan.com/?key=${LEGISCAN_API_KEY}&op=getSearch&state=ALL&query=ESG`);
    const legislation = response.data.searchresult;
    const content = Buffer.from(JSON.stringify(legislation, null, 2)).toString('base64');
    
    // Get the SHA of the existing file to update it
    let sha;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: '_data/legislation.json',
      });
      sha = data.sha;
    } catch (error) {
      // If the file doesn't exist, sha will be undefined, and a new file will be created.
      if (error.status !== 404) {
        throw error;
      }
    }

    // Create or update the file in the GitHub repository
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: '_data/legislation.json',
      message: 'Update legislative data',
      content,
      sha,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Legislation data updated successfully.' }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error fetching or updating legislation data.' }),
    };
  }
};
