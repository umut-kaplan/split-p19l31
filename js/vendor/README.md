# Eingebundene Bibliotheken

| Datei | Herkunft | Version | Lizenz |
|---|---|---|---|
| `zxing.min.js` | `@zxing/library`, Datei `umd/index.min.js` aus dem npm-Paket | 0.23.0 | Apache-2.0, siehe `zxing.LICENSE.txt` |
| `fflate.js` | `fflate`, Datei `esm/browser.js` aus dem npm-Paket | 0.8.3 | MIT, siehe `fflate.LICENSE.txt` |

`zxing.min.js` liest Barcodes aus Kamerabildern, wo der Browser keinen `BarcodeDetector` hat (iOS Safari). Die App lädt die Datei erst, wenn der Scanner geöffnet wird.

`fflate.js` entpackt den Apple-Health-Export (`export.zip`) Stück für Stück, ohne die ganze Datei in den Speicher zu laden. Die App lädt die Datei erst, wenn ein Import startet.
