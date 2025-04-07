const axios = require('axios');
const cheerio = require('cheerio');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { sampleHtmlWithYale } = require('./test-utils');
const nock = require('nock');
const http = require('http');
const { app } = require('../app'); // Import app directly

// Set a different port for testing to avoid conflict with the main app
const TEST_PORT = 3099;
let server;
let originalConsoleError;
let originalConsoleLog;

describe('Integration Tests', () => {
  // Start the server before tests
  beforeAll(async () => {
    // Save original console methods
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    // Mock console methods to suppress logs during tests
    console.error = jest.fn();
    console.log = jest.fn();

    // Disable all net connections except localhost
    nock.disableNetConnect();
    nock.enableNetConnect((host) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host));
    
    // Create the server from our app directly instead of spawning a child process
    server = http.createServer(app);
    await new Promise(resolve => {
      server.listen(TEST_PORT, () => {
        console.log(`Test server started on port ${TEST_PORT}`);
        resolve();
      });
    });
    
    // Mock server setup for example.com
    nock('http://example.com')
      .persist()
      .get('/')
      .reply(200, sampleHtmlWithYale);
  }, 10000);

  afterAll(async () => {
    // Restore original console methods
    console.error = originalConsoleError;
    console.log = originalConsoleLog;

    // Close the server when done
    if (server && server.listening) {
      await new Promise(resolve => server.close(resolve));
    }
    nock.cleanAll();
    nock.enableNetConnect();
  });  

  afterEach(() => {
    // Clear any lingering nock interceptors after each test
    nock.cleanAll();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Make a request to our proxy app targeting example.com
    const response = await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
      url: 'http://example.com/'
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
  }, 10000);

  test('Should handle invalid URLs', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {
        url: 'not-a-valid-url'
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.response.status).toBe(500);
      expect(error.response.data.error).toContain('Failed to fetch content');
    }
  });

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://localhost:${TEST_PORT}/fetch`, {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('URL is required');
    }
  });
});