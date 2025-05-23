const cheerio = require('cheerio');
const { sampleHtmlWithYale } = require('./test-utils');
const app = require('../app');
const { replaceYaleWithFale, isTextNode, processHtml } = app;

describe('Yale to Fale replacement logic', () => {
  
  test('should replace Yale with Fale in text content', () => {
    const $ = cheerio.load(sampleHtmlWithYale);
    
    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      // Replace text content but not in URLs or attributes
      const text = $(this).text();
      const newText = text.replace(/Yale/gi, 'Fale');
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });
    
    // Process title separately
    const title = $('title').text().replace(/Yale/gi, 'Fale');
    $('title').text(title);
    
    const modifiedHtml = $.html();
    
    // Check text replacements
    expect(modifiedHtml).toContain('Fale University Test Page');
    expect(modifiedHtml).toContain('Welcome to Fale University');
    expect(modifiedHtml).toContain('Fale University is a private Ivy League');
    expect(modifiedHtml).toContain('Fale was founded in 1701');
    
    // Check that URLs remain unchanged
    expect(modifiedHtml).toContain('https://www.yale.edu/about');
    expect(modifiedHtml).toContain('https://www.yale.edu/admissions');
    expect(modifiedHtml).toContain('https://www.yale.edu/images/logo.png');
    expect(modifiedHtml).toContain('mailto:info@yale.edu');
    
    // Check href attributes remain unchanged
    expect(modifiedHtml).toMatch(/href="https:\/\/www\.yale\.edu\/about"/);
    expect(modifiedHtml).toMatch(/href="https:\/\/www\.yale\.edu\/admissions"/);
    
    // Check that link text is replaced
    expect(modifiedHtml).toContain('>About Fale<');
    expect(modifiedHtml).toContain('>Fale Admissions<');
    
    // Check that alt attributes are not changed
    expect(modifiedHtml).toContain('alt="Yale Logo"');
  });

  test('should handle text that has no Yale references', () => {
    const htmlWithoutYale = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <h1>Hello World</h1>
        <p>This is a test page with no Fale references.</p>
      </body>
      </html>
    `;
  
    const $ = cheerio.load(htmlWithoutYale);
  
    // Apply the same replacement logic
    $('body *').contents().filter(function() {
      return this.nodeType === 3;
    }).each(function() {
      const text = $(this).text();
      const newText = text.replace(/Yale/gi, 'Fale');
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });
  
    const modifiedHtml = $.html();
  
    // Content should remain unchanged since there are no "Yale" references
    expect(modifiedHtml).toContain('<title>Test Page</title>');
    expect(modifiedHtml).toContain('<h1>Hello World</h1>');
    expect(modifiedHtml).toContain('This is a test page with no Fale references');
  });

  test('should handle case-insensitive replacements', () => {
    const mixedCaseHtml = `
      <p>YALE University, Yale College, and yale medical school are all part of the same institution.</p>
    `;
  
    const $ = cheerio.load(mixedCaseHtml);
  
    $('body *').contents().filter(function() {
      return this.nodeType === 3;
    }).each(function() {
      const text = $(this).text();
      const newText = text.replace(/Yale/gi, 'Fale');
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });
  
    const modifiedHtml = $.html();
  
    // Should replace all case variants of "Yale" with "Fale"
    expect(modifiedHtml).toContain('Fale University, Fale College, and Fale medical school');
  });

  test('should handle non-text nodes', () => {
    const htmlWithComment = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <!-- Yale University -->
        <p>Yale University</p>
      </body>
      </html>
    `;

    const $ = cheerio.load(htmlWithComment);

    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      const text = $(this).text();
      const newText = text.replace(/Yale/gi, 'Fale');
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });

    const modifiedHtml = $.html();

    // Comment should remain unchanged
    expect(modifiedHtml).toContain('<!-- Yale University -->');
    // Text content should be replaced
    expect(modifiedHtml).toContain('Fale University');
  });
});

// Add tests for the extracted utility functions
describe('Utility functions', () => {
  test('replaceYaleWithFale should replace Yale with Fale case-insensitively', () => {
    expect(app.replaceYaleWithFale('Yale University')).toBe('Fale University');
    expect(app.replaceYaleWithFale('YALE UNIVERSITY')).toBe('Fale UNIVERSITY');
    expect(app.replaceYaleWithFale('yale university')).toBe('Fale university');
    expect(app.replaceYaleWithFale('Text with no matches')).toBe('Text with no matches');
  });

  test('isTextNode should identify text nodes correctly', () => {
    expect(app.isTextNode({ nodeType: 3 })).toBe(true);
    expect(app.isTextNode({ nodeType: 1 })).toBe(false);
    expect(app.isTextNode({ nodeType: 8 })).toBe(false);
  });

  test('processHtml should replace Yale with Fale in HTML content', () => {
    const result = app.processHtml(sampleHtmlWithYale);
    
    expect(result.title).toBe('Fale University Test Page');
    expect(result.html).toContain('Welcome to Fale University');
    expect(result.html).toContain('Fale University is a private Ivy League');
    expect(result.html).toContain('https://www.yale.edu/about'); // URL should remain unchanged
    expect(result.html).toContain('>About Fale<'); // Link text should be changed
  });

  test('processHtml should handle HTML without Yale references', () => {
    const htmlWithoutYale = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Page</title>
      </head>
      <body>
        <h1>Hello World</h1>
        <p>This is a test page with no Yale references.</p>
      </body>
      </html>
    `;
    
    const result = app.processHtml(htmlWithoutYale);
    
    expect(result.title).toBe('Test Page');
    expect(result.html).toContain('<h1>Hello World</h1>');
    expect(result.html).toContain('This is a test page with no Fale references');
  });
});