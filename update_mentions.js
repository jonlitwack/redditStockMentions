const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to get Reddit mentions
async function getRedditMentions(ticker) {
  const url = `https://api.pushshift.io/reddit/search/comment/?q=${ticker}`;
  try {
    const response = await axios.get(url);
    return response.data.data.length;
  } catch (error) {
    console.error(`Failed to fetch mentions for ${ticker}:`, error);
    return 0;
  }
}

// Function to update mentions in Supabase
async function updateMentions(ticker, count) {
  const { data, error } = await supabase
    .from('securities')
    .update({ mentions: count })
    .eq('ticker', ticker);
  
  if (error) {
    console.error(`Failed to update mentions for ${ticker}:`, error);
  } else {
    console.log(`Updated ${ticker} with ${count} mentions.`);
  }
}

// Main function to pull mentions and update database
async function updateMentionsForAllSecurities() {
  const { data, error } = await supabase
    .from('securities')
    .select('ticker');
  
  if (error) {
    console.error('Failed to fetch securities:', error);
    return;
  }
  
  for (let security of data) {
    const count = await getRedditMentions(security.ticker);
    await updateMentions(security.ticker, count);
  }
}

// Execute the function
updateMentionsForAllSecurities();