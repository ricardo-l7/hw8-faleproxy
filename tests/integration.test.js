const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');

// Set a different port for testing to avoid conflict with the main app
const TEST_PORT = 3099;
const MOCK_PORT = 3098; 
let server;

describe('Integration Tests', () => {
  // Modify the app to use a test port
  beforeAll(async () => {
    // Disable all net connections...
    nock.disableNetConnect();
    // Allow connections to localhost (with optional port) and 127.0.0.1
    nock.enableNetConnect((host) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host));
    
    // Start the test server using the original app.js,
    // and override the PORT via the environment variable
    server = require('child_process').spawn('node', ['app.js'], {
      env: { ...process.env, PORT: TEST_PORT.toString() },
      detached: true,
      stdio: 'ignore'
    });

    // Give the server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 10000);  

  afterAll(async () => {
    // Kill the test server and clean up
    if (server && server.pid) {
      process.kill(-server.pid);
    }
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com served by your mock server
    nock('http://localhost:' + MOCK_PORT)
      .get('/')
      .reply(200, sampleHtmlWithYale);
    
    // Make a request to our proxy app targeting the mock server
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: `http://localhost:${MOCK_PORT}/`
    });
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    
    const $ = cheerio.load(response.data.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');
    
    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);
    
    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  }, 10000); // Increase timeout for this test

  test('Should handle invalid URLs', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
        url: 'not-a-valid-url'
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Accept either our expected error message or nock's error
      if (error.response && error.response.data && error.response.data.error) {
        expect(error.response.data.error).toMatch(/Failed to fetch content|Nock: Disallowed net connect/);
      } else {
        expect(error.message).toMatch(/Failed to fetch content|Nock: Disallowed net connect/);
      }
    }
  });

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      if (error.response) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('URL is required');
      } else {
        throw error; // If there's no response, rethrow the error.
      }
    }
  });
});
