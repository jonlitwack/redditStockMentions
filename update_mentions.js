const snoowrap = require('snoowrap');
const { createClient } = require('@supabase/supabase-js');
<<<<<<< HEAD
const dayjs = require('dayjs');
const util = require('util');
=======
const { chromium } = require('playwright');
const pLimit = require('p-limit');
const dayjs = require('dayjs');
>>>>>>> origin/main

require('dotenv').config();

const sleep = util.promisify(setTimeout);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

<<<<<<< HEAD
const reddit = new snoowrap({
    userAgent: 'Reddit Mention Counter',
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN
});

const fetchCompanyData = async () => {
    console.log('Fetching company data from Supabase...');
    let { data: companies, error } = await supabase
        .from('global_stocks')
        .select('symbol, name, reddit_mentions');
    
    if (error) {
        console.error('Error fetching company data:', error);
        return [];
    }
    console.log(`Fetched ${companies.length} companies from Supabase.`);
    return companies;
};
=======
// Delay function to pause execution for a given number of milliseconds
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch the number of Reddit mentions for a company within the past 90 days
 * @param {string} companyName - The name to search for in Reddit mentions
 * @returns {Promise<number>} The count of mentions found
 */
async function getRedditMentions(companyName) {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let mentionsCount = 0;
    let hasNextPage = true;
    const startTime = dayjs().subtract(90, 'day');

    await page.goto(`https://www.reddit.com/search/?q=${encodeURIComponent(companyName)}&sort=new&type=comment`);

    while (hasNextPage) {
        await page.waitForSelector('div[data-testid="comment"]');

        const comments = await page.$$('div[data-testid="comment"]', nodes => {
            return nodes.map(n => {
                const timestampElement = n.querySelector('a[data-click-id="timestamp"] time');
                const timestamp = timestampElement ? timestampElement.getAttribute('datetime') : null;
                return {
                    text: n.innerText,
                    timestamp: timestamp
                };
            })
        });

        for (const comment of comments) {
            if (comment.timestamp && dayjs(comment.timestamp).isBefore(startTime)) {
                // Stop searching if we find a comment older than 90 days
                hasNextPage = false;
                break;
              }
              mentionsCount++;
        }

        if (hasNextPage) {
            // Check if there's a "Next" button to load more comments
            const nextButton = await page.$('span.next-button > a'); // Adjust selector based on actual structure
            if (nextButton) {
                await nextButton.click();
                await delay(2000); // Introduce a delay to mimic human interaction
            } else {
                hasNextPage = false;
            }
        }
    }
    await browser.close();
    return mentionsCount;
}
>>>>>>> origin/main

const getMentions = async (companyName) => {
    console.log(`Fetching mentions for company: ${companyName}`);
    const ninetyDaysAgo = dayjs().subtract(90, 'day').unix();
    let after = null;
    let mentions = 0;
    let count = 0;

    try {
        do {
            count++;
            console.log(`Fetching batch ${count} for company: ${companyName}, after: ${after}`);
            const searchResults = await reddit.search({
                query: `"${companyName}"`, // Exact match search to reduce noise
                sort: 'new',
                time: 'all',
                limit: 100,
                after
            });

            if (searchResults.length === 0) break;

            searchResults.forEach(post => {
                if (dayjs(post.created_utc * 1000).isAfter(ninetyDaysAgo)) {
                    mentions++;
                }
            });

<<<<<<< HEAD
            after = searchResults.length ? searchResults[searchResults.length - 1].name : null;
            console.log(`Processed batch ${count} for company: ${companyName}, current mentions: ${mentions}`);
            await sleep(2000); // Sleep for 2 seconds between requests to avoid rate limiting
        } while (after && count < 30); // Safeguard to prevent infinite loops
=======
  const limit = pLimit(3); // Limit concurrent API calls
>>>>>>> origin/main

        console.log(`Total mentions for ${companyName}: ${mentions}`);
    } catch (error) {
        console.error(`Error fetching mentions for ${companyName}:`, error);
    }

    return mentions;
};

const updateMentions = async (symbol, mentions) => {
    console.log(`Updating mentions for symbol: ${symbol}`);
    const { error } = await supabase
        .from('global_stocks')
        .update({ reddit_mentions: mentions })
        .eq('symbol', symbol);

    if (error) {
        console.error(`Error updating mentions for ${symbol}:`, error);
    } else {
        console.log(`Successfully updated mentions for ${symbol}: ${mentions}`);
    }
};

const countAllMentions = async () => {
    console.log('Starting to count all mentions...');
    const companies = await fetchCompanyData();

    for (const company of companies) {
        const mentions = await getMentions(company.name);
        await updateMentions(company.symbol, mentions);
        await sleep(2000); // Sleep for 2 seconds between each company processing to avoid rate limits
    }
    console.log('Finished counting and updating mentions for all companies.');
};

countAllMentions().then(() => console.log('Mention counting script completed.'));