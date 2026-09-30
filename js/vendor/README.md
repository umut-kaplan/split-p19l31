# Eingebundene Bibliotheken

| Datei | Herkunft | Version | Lizenz |
|---|---|---|---|
| `zxing.min.js` | `@zxing/library`, Datei `umd/index.min.js` aus dem npm-Paket | 0.23.0 | Apache-2.0, siehe `zxing.LICENSE.txt` |
| `fflate.js` | `fflate`, Datei `esm/browser.js` aus dem npm-Paket | 0.8.3 | MIT, siehe `fflate.LICENSE.txt` |

`zxing.min.js` liest Barcodes und QR-Codes aus Kamerabildern, wo der Browser keinen `BarcodeDetector` hat (iOS Safari), und erzeugt die QR-Codes für den Vergleich (`js/ui/qr.js`). Die App lädt die Datei erst, wenn ein Scanner oder ein QR-Code sie braucht (`js/ui/zxing.js`).

`fflate.js` entpackt den Apple-Health-Export (`export.zip`) Stück für Stück, ohne die ganze Datei in den Speicher zu laden. Die App lädt die Datei erst, wenn ein Import startet.
