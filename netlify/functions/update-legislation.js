// This script is run at build time to fetch the latest legislative data.
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// --- IMPORTANT ---
// The original script referenced a local-only file: `../utils/legiscan`.
// To ensure the build works, the core fetching logic has been moved directly
// into this file using the 'axios' library, which is already a dependency.
// You will need to add your Legiscan API key as a build environment variable
// in the Netlify UI. The key should be named `LEGISCAN_API_KEY`.

const API_KEY = process.env.LEGISCAN_API_KEY;

/**
 * A simple wrapper to fetch a master list of bills for a given state from Legiscan.
 * @param {string} state - The two-letter abbreviation for the state (e.g., 'TX').
 * @returns {Promise<Object|null>} The JSON response from the Legiscan API or null if no data is available.
 */
async function getMasterList(state) {
  if (!API_KEY) {
    throw new Error('LEGISCAN_API_KEY is not defined in the environment variables.');
  }
  const url = `https://api.legiscan.com/?key=${API_KEY}&op=getMasterList&state=${state}`;
  console.log(`Fetching master bill list for ${state}...`);
  const { data } = await axios.get(url);

  if (data.status === 'ERROR') {
    throw new Error(`Legiscan API error for state ${state}: ${data.alert.message}`);
  }

  const masterlist = data.masterlist;

  // **FIX APPLIED HERE**
  // This check handles cases where the API returns a null or invalid masterlist object.
  if (!masterlist || typeof masterlist !== 'object' || Object.keys(masterlist).length === 0) {
    console.warn(`WARN: No valid masterlist data returned from API for state: ${state}. Skipping.`);
    return null; // Return null to gracefully skip this state.
  }

  // The master list is nested under a dynamic key, so we extract it.
  const key = Object.keys(masterlist).find(k => k !== 'session');
  return masterlist[key];
}


/**
 * The main function to update legislation data.
 * It fetches the master bill lists for a predefined set of states
 * and writes the result to a JSON file in the `_data` directory.
 */
async function updateLegislationData() {
  if (!API_KEY) {
    console.warn("WARN: LEGISCAN_API_KEY environment variable not set. Skipping data fetch.");
    // Create an empty file to prevent build errors if the file is expected to exist.
    const outputPath = path.resolve(__dirname, '../../_data/billLists.json');
     if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify({}), 'utf-8');
    return; // Exit gracefully.
  }

  try {
    const states = ["AL", "AK", "AZ", "AR", "FL", "GA", "ID", "IN", "IA", "KS", "KY", "LA", "MS", "MO", "MT", "NE", "NV", "NC", "ND", "OH", "OK", "PA", "SC", "SD", "TX", "UT", "WV", "WI", "WY"];
    const allBillLists = {};

    for (const state of states) {
      try {
        const bills = await getMasterList(state);

        // **FIX APPLIED HERE**
        // Only process and log if the `getMasterList` function returned valid bill data.
        if (bills) {
          allBillLists[state] = bills;
          console.log(`Successfully fetched ${Object.keys(bills).length} bills for ${state}.`);
        }
      } catch (stateError) {
        console.error(`Could not fetch data for state: ${state}. Error: ${stateError.message}`);
        // Continue to the next state even if one fails.
      }
    }

    const outputPath = path.resolve(__dirname, '../../_data/billLists.json');
    
    // Ensure the _data directory exists before writing the file
    if (!fs.existsSync(path.dirname(outputPath))) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(allBillLists, null, 2), 'utf-8');
    console.log(`Successfully updated and wrote legislation data to ${outputPath}`);
  } catch (error) {
    console.error('A critical error occurred during the legislation data fetch process:', error);
    process.exit(1); // Exit with an error code to fail the build
  }
}

// Self-execute the main function when the script is run.
updateLegislationData();

