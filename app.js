const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// Extract text replacement function for better testability
function replaceYaleWithFale(text) {
  return text.replace(/Yale/gi, 'Fale');
}

// Extract filter function for better testability
function isTextNode(node) {
  return node.nodeType === 3; // Text nodes only
}

// Extract HTML processing function for better testability
function processHtml(html) {
  const $ = cheerio.load(html);
  
  // Process text nodes in the body
  $('body *').contents().filter(function() {
    return isTextNode(this);
  }).each(function() {
    // Replace text content but not in URLs or attributes
    const text = $(this).text();
    const newText = replaceYaleWithFale(text);
    if (text !== newText) {
      $(this).replaceWith(newText);
    }
  });
  
  // Process title separately
  const title = replaceYaleWithFale($('title').text());
  $('title').text(title);
  
  return { html: $.html(), title };
}

// Create app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;
    
    // Process the HTML
    const processed = processHtml(html);
    
    return res.json({ 
      success: true, 
      content: processed.html,
      title: processed.title,
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({ 
      error: `Failed to fetch content: ${error.message}` 
    });
  }
});

// Start the server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Export the app and utility functions for testing
module.exports = {
  app,
  replaceYaleWithFale,
  isTextNode,
  processHtml
};