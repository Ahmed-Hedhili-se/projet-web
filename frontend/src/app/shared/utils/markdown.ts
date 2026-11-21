import { Marked } from 'marked';

function escapeHtml(text: string): string {
  // « <b> » → « &lt;b&gt; » : le HTML brut s'affiche comme du texte
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const parser = new Marked({
  gfm: true, // tableaux et listes « GitHub »
  breaks: true, // un retour à la ligne simple = <br>
  renderer: {
    html: ({ text }) => escapeHtml(text), // docs/API.md : jamais de HTML brut (le texte peut citer un dépôt)
    link: ({ href, text }) =>
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`,
    image: ({ text }) => escapeHtml(text), // pas d'image distante : seulement son texte
  },
});

export function renderMarkdown(text: string): string {
  // Markdown → HTML sûr, à afficher avec [innerHTML] (Angular le nettoie encore)
  return parser.parse(text, { async: false });
}
