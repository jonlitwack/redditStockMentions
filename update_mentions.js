const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');
const pLimit = require('p-limit');
const dayjs = require('dayjs');

require('dotenv').config();


// Initialize Supabase with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

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

  const limit = pLimit(3); // Limit concurrent API calls

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