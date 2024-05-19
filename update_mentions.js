const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const pLimit = require('p-limit');
require('dotenv').config();


// Initialize Supabase with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Reddit API endpoint for public search
const redditSearchUrl = 'https://www.reddit.com/search.json';

// Delay function to pause execution for a given number of milliseconds
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch the number of Reddit mentions for a company within the past 90 days
 * @param {string} companyName - The name to search for in Reddit mentions
 * @returns {Promise<number>} The count of mentions found
 */
async function getRedditMentions(companyName) {
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - (90 * 24 * 60 * 60); // 90 days ago
  let mentionsCount = 0;
  let after = null;

  while (true) {
    try {
      const url = `${redditSearchUrl}?q=${encodeURIComponent(companyName)}&sort=new&type=comment&limit=100&restrict_sr=on&before=${endTime}&after=${startTime}${after ? `&after=${after}` : ''}`;
      const response = await axios.get(url);

      const comments = response.data.data.children;
      mentionsCount += comments.length;

      if (!response.data.data.after) {
        break;
      }
      after = response.data.data.after;

      // Respect Reddit's rate limiting by introducing delay
      await delay(2000); // Adjust based on observed rate limits

    } catch (error) {
        if (error.response && error.response.status === 429) {
            // HTTP 429: Too Many Requests
            const retryAfter = error.response.headers['retry-after'] || 60; // Default to retry after 60 seconds
            console.log(`Rate limited, retrying after ${retryAfter} seconds...`);
            await delay(retryAfter * 1000);
        } else {
            console.error(`Failed to fetch mentions for ${companyName}:`, error);
            break;
        }
    }
  }
  return mentionsCount;
}

/**
 * Update the mentions count in Supabase for a particular ticker
 * @param {string} symbol - The security's ticker symbol
 * @param {number} count - The number of mentions to update
 * @returns {Promise<void>}
 */
async function updateMentions(symbol, count) {
  const { data, error } = await supabase
    .from('global_stocks')
    .update({ reddit_mentions: count })
    .eq('symbol', symbol); // Use the ticker to find the record

  if (error) {
    console.error(`Failed to update mentions for ${symbol}:`, error);
  } else {
    console.log(`Updated ${symbol} with ${count} Reddit mentions.`);
  }
}

// Main function to pull mentions and update database
async function updateMentionsForAllSecurities() {
  const { data, error } = await supabase
    .from('global_stocks')
    .select('symbol, name'); // Select the ticker symbols and company names

  if (error) {
    console.error('Failed to fetch securities:', error);
    return;
  }

  const limit = pLimit(5); // Limit concurrent API calls

  const tasks = data.map((security) =>
    limit(async () => {
      const count = await getRedditMentions(security.name);
      await updateMentions(security.symbol, count);
    })
  );

  await Promise.all(tasks);
}

// Execute the function
updateMentionsForAllSecurities();