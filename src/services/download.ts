/* Descarga un texto como archivo (CSV, plantillas) y convierte data URL en archivos. */

/** data URL → Blob (para subirlo o abrirlo en otra pestaña). */
export function blobFromDataUrl(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',', 2);
  const type = /^data:([^;]+)/.exec(head)?.[1] || 'application/octet-stream';
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
