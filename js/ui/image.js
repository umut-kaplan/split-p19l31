/* Bilder vor dem Speichern verkleinern. Safari dreht Fotos beim Laden nach ihren EXIF-Angaben richtig. */
export function resizeImage(file, maxSide = 1080, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob(b => (b ? resolve(b) : reject(new Error('Bild ließ sich nicht umwandeln.'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Das Bild ließ sich nicht öffnen.')); };
    img.src = url;
  });
}

export const blobToDataURL = blob => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export async function dataURLToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}
