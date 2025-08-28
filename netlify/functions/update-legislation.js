// Import necessary libraries.
// axios is used for making HTTP requests to the LegiScan API.
// @octokit/rest is for interacting with the GitHub API to commit the new data.
// @netlify/functions provides the scheduling wrapper.
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const { schedule } = require('@netlify/functions');

// Retrieve sensitive keys and repository information from Netlify environment variables.
// This is a secure way to handle API keys without hardcoding them.
const LEGISCAN_API_KEY = process.env.LEGISCAN_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER; // Your GitHub username or organization
const REPO_NAME = process.env.REPO_NAME;   // The name of your repository
const DATA_FILE_PATH = '_data/legislation.json';

// The search query to find relevant bills in the LegiScan database.
const SEARCH_QUERY = '"ESG" OR "fiduciary duty" OR "economic boycott" OR "state divestment"';

/**
 * The main handler for the Netlify Scheduled Function.
 * This function will be executed based on the cron schedule.
 */
const handler = async function(event, context) {
    console.log("Starting scheduled legislative data update...");

    try {
        // Step 1: Fetch the latest legislative data from the LegiScan API.
        const response = await axios.get('https://api.legiscan.com/', {
            params: {
                key: LEGISCAN_API_KEY,
                op: 'search',
                query: SEARCH_QUERY,
            }
        });

        // Check if the API call was successful and returned the expected data structure.
        if (response.data.status === 'OK' && response.data.searchresult) {
            // The API returns a summary object along with bill objects. We filter to get only the bills.
            const bills = Object.values(response.data.searchresult).filter(item => item.bill_id);
            
            // Step 2: Process the raw bill data into a clean, state-by-state summary.
            const processedData = processLegislationData(bills);
            const contentToCommit = JSON.stringify({
                last_updated: new Date().toISOString(),
                states: processedData
            }, null, 2);

            // Step 3: Commit the new JSON data file to the GitHub repository.
            await commitToGitHub(contentToCommit);

            console.log("Legislative data update successful.");
            return { statusCode: 200, body: "Update successful." };
        } else {
            // If the API response is not what we expect, throw an error.
            throw new Error('LegiScan API call failed or returned an unexpected structure.');
        }

    } catch (error) {
        console.error("Error during the legislative update process:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

/**
 * Processes raw bill data from LegiScan into a structured, state-by-state summary.
 * This function also determines an `overallStatus` for each state to simplify map coloring.
 * @param {Array} bills - An array of bill objects from the LegiScan API.
 * @returns {Object} A summary of legislative activity, keyed by state abbreviation.
 */
function processLegislationData(bills) {
    const stateSummary = {};

    bills.forEach(bill => {
        if (!bill.state) return;

        // Initialize the state object if it doesn't exist.
        if (!stateSummary[bill.state]) {
            stateSummary[bill.state] = {
                bills: [],
                overallStatus: 'No Action' // Default status
            };
        }

        // Add relevant bill details to the state's list.
        stateSummary[bill.state].bills.push({
            bill_id: bill.bill_id,
            number: bill.bill_number,
            title: bill.title,
            // LegiScan status codes: 1=Introduced, 2=In Progress, 3=Failed, 4=Enacted
            status_code: bill.status,
            url: bill.url,
            last_action_date: bill.last_action_date
        });
    });

    // Determine the overall status for each state based on the status of its bills.
    // The status is prioritized: Enacted > Pending > Failed.
    Object.keys(stateSummary).forEach(state => {
        const billsInState = stateSummary[state].bills;
        const isEnacted = billsInState.some(b => b.status_code === 4);
        const isPending = billsInState.some(b => b.status_code === 1 || b.status_code === 2);
        const allFailed = billsInState.every(b => b.status_code === 3);

        if (isEnacted) {
            stateSummary[state].overallStatus = 'Enacted';
        } else if (isPending) {
            stateSummary[state].overallStatus = 'Pending';
        } else if (allFailed && billsInState.length > 0) {
             stateSummary[state].overallStatus = 'Failed';
        }
    });

    return stateSummary;
}

/**
 * Commits a file to the GitHub repository.
 * It will update the file if it exists or create it if it doesn't.
 * @param {string} content - The string content to be committed.
 */
async function commitToGitHub(content) {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    let currentSHA = null;
    try {
        // We need the SHA of the existing file to update it.
        const { data: fileData } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: DATA_FILE_PATH,
        });
        currentSHA = fileData.sha;
    } catch (error) {
        if (error.status === 404) {
            // If the file doesn't exist, we'll create it. The SHA will be null.
            console.log(`File not found at ${DATA_FILE_PATH}. A new file will be created.`);
        } else {
            // Rethrow other errors (e.g., auth issues).
            throw error;
        }
    }

    // Use the GitHub API to create or update the file.
    await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: DATA_FILE_PATH,
        message: 'Automated Update: Refresh legislative data via Netlify Function',
        content: Buffer.from(content).toString('base64'), // Content must be base64 encoded
        sha: currentSHA, // If SHA is null, it creates a new file. If provided, it updates.
        branch: 'main',
    });

    console.log(`Successfully committed update to ${DATA_FILE_PATH}`);
}

// Export the handler and schedule it to run daily at 1 AM UTC using a cron expression.
module.exports.handler = schedule("0 1 * * *", handler);
