import { Marked } from 'marked';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const parser = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html: ({ text }) => escapeHtml(text),
    link: ({ href, text }) =>
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`,
    image: ({ text }) => escapeHtml(text),
  },
});

export function renderMarkdown(text: string): string {
  return parser.parse(text, { async: false });
}
