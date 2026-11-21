export function downloadCsv(filename: string, rows: (string | number | boolean)[][]): void {
  // télécharge un tableau en fichier .csv (ouvrable dans Excel)
  const escape = (value: string | number | boolean) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; // guillemets si la valeur contient , " ou un retour à la ligne
  };
  const csv = rows.map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); // marqueur BOM : Excel lit bien les accents
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click(); // déclenche le téléchargement
  URL.revokeObjectURL(url);
}
