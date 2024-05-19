const snoowrap = require('snoowrap');
const { createClient } = require('@supabase/supabase-js');
const dayjs = require('dayjs');
const util = require('util');

require('dotenv').config();

const sleep = util.promisify(setTimeout);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

            after = searchResults.length ? searchResults[searchResults.length - 1].name : null;
            console.log(`Processed batch ${count} for company: ${companyName}, current mentions: ${mentions}`);
            await sleep(2000); // Sleep for 2 seconds between requests to avoid rate limiting
        } while (after && count < 30); // Safeguard to prevent infinite loops

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