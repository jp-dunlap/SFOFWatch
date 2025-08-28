const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const { schedule } = require('@netlify/functions');

const LEGISCAN_API_KEY = process.env.LEGISCAN_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const DATA_FILE_PATH = '_data/legislation.json';
const SEARCH_QUERY = '"ESG" OR "fiduciary duty" OR "economic boycott" OR "state divestment"';

const handler = async function(event, context) {
    console.log("Starting legislative data update...");

    try {
        // 1. Fetch data from LegiScan
        const response = await axios.get('https://api.legiscan.com/', {
            params: {
                key: LEGISCAN_API_KEY,
                op: 'search',
                query: SEARCH_QUERY,
            }
        });

        if (response.data.status === 'OK' && response.data.searchresult) {
            // Filter out the summary object, keeping only bill objects
            const bills = Object.values(response.data.searchresult).filter(item => item.bill_id);
            
            // 2. Process the data into a state-by-state summary
            const processedData = processLegislationData(bills);
            const contentToCommit = JSON.stringify({
                last_updated: new Date().toISOString(),
                states: processedData
            }, null, 2);

            // 3. Commit to GitHub
            await commitToGitHub(contentToCommit);

            return { statusCode: 200, body: "Update successful." };
        } else {
            throw new Error('LegiScan API call failed or returned unexpected structure.');
        }

    } catch (error) {
        console.error("Error during update process:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};

// Helper function to summarize LegiScan data by state
function processLegislationData(bills) {
    const stateSummary = {};

    bills.forEach(bill => {
        if (!bill.state) return;

        if (!stateSummary[bill.state]) {
            stateSummary[bill.state] = {
                bills: [],
                overallStatus: 'No Action'
            };
        }

        stateSummary[bill.state].bills.push({
            bill_id: bill.bill_id,
            number: bill.bill_number,
            title: bill.title,
            // LegiScan status codes: 1=Introduced, 2=Engrossed/In Progress, 3=Dead/Failed/Vetoed, 4=Passed/Enacted
            status_code: bill.status,
            url: bill.url,
            last_action_date: bill.last_action_date
        });
    });

    // Determine overall status for the map visualization based on priority
    Object.keys(stateSummary).forEach(state => {
        const bills = stateSummary[state].bills;
        const enacted = bills.some(b => b.status_code === 4);
        const pending = bills.some(b => b.status_code === 1 || b.status_code === 2);
        const failed = bills.every(b => b.status_code === 3); // Only failed if all are failed

        if (enacted) {
            stateSummary[state].overallStatus = 'Enacted';
        } else if (pending) {
            stateSummary[state].overallStatus = 'Pending';
        } else if (failed && bills.length > 0) {
             stateSummary[state].overallStatus = 'Failed';
        }
    });

    return stateSummary;
}

async function commitToGitHub(content) {
    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    let currentSHA = null;
    try {
        // Get the SHA of the existing file to update it
        const { data: fileData } = await octokit.repos.getContent({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            path: DATA_FILE_PATH,
        });
        currentSHA = fileData.sha;
    } catch (error) {
        if (error.status === 404) {
            console.log("File not found, creating new file.");
            // If file doesn't exist (404), SHA remains null for creation
        } else {
            throw error;
        }
    }

    await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: DATA_FILE_PATH,
        message: 'Automated Update: Legislation data refresh via Netlify Function',
        content: Buffer.from(content).toString('base64'),
        sha: currentSHA,
        branch: 'main',
    });
}

// Schedule the function to run daily at 1 AM UTC
module.exports.handler = schedule("0 1 * * *", handler);
