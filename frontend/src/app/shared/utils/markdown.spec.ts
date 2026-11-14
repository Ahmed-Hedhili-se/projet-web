import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('should render bold text, lists and tables', () => {
    const html = renderMarkdown('Best architecture: **Hopper**\n\n- one\n- two\n\n| GPU | Cost |\n|---|---|\n| H100 | $38 |');
    expect(html).toContain('<strong>Hopper</strong>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<td>H100</td>');
  });

  it('should never output raw HTML coming from the text', () => {
    const html = renderMarkdown('Hello <img src=x onerror="alert(1)"> and <script>alert(2)</script>\n\n![logo](https://example.com/a.png)');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img');
  });

  it('should open links in a new tab', () => {
    expect(renderMarkdown('[repo](https://github.com/acme/llm)')).toContain('<a href="https://github.com/acme/llm" target="_blank" rel="noopener noreferrer">repo</a>');
  });
});
