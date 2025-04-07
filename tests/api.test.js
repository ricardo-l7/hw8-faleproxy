const request = require('supertest');
const nock = require('nock');
const path = require('path');
const { sampleHtmlWithYale } = require('./test-utils');
const app = require('../app');

describe('API Endpoints', () => {
  let originalConsoleError;
  let server;

  beforeAll(() => {
    // Save original console.error
    originalConsoleError = console.error;
    // Mock console.error to suppress logs during tests
    console.error = jest.fn();
    
    // Disable real HTTP requests during testing
    nock.disableNetConnect();
    // Allow localhost connections for supertest
    nock.enableNetConnect('127.0.0.1');
  });

  afterAll(() => {
    // Restore original console.error
    console.error = originalConsoleError;
    
    // Clean up nock
    nock.cleanAll();
    nock.enableNetConnect();
    if (server) server.close();
  });

  afterEach(() => {
    // Clear any lingering nock interceptors after each test
    nock.cleanAll();
  });

  test('Server should start successfully', (done) => {
    const PORT = 3002;
    server = app.listen(PORT, () => {
      expect(server.address().port).toBe(PORT);
      done();
    });
  });

  test('GET / should serve the main page', async () => {
    const response = await request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200);

    expect(response.text).toContain('<!DOCTYPE html>');
  });

  test('POST /fetch should return 400 if URL is missing', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe('URL is required');
  });

  test('POST /fetch should fetch and replace Yale with Fale', async () => {
    // Mock the external URL
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' });

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.title).toBe('Fale University Test Page');
    expect(response.body.content).toContain('Welcome to Fale University');
    expect(response.body.content).toContain('https://www.yale.edu/about');  // URL should be unchanged
    expect(response.body.content).toContain('>About Fale<');  // Link text should be changed
  });

  test('POST /fetch should handle errors from external sites', async () => {
    // Mock a failing URL
    nock('https://error-site.com')
      .get('/')
      .replyWithError('Connection refused');

    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://error-site.com/' });

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toContain('Failed to fetch content');
  });
});
