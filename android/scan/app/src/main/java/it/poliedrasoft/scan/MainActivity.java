package it.poliedrasoft.scan;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.IntentSender;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanner;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.languageid.LanguageIdentification;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import java.io.*;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * SCAN-MLKIT (PO 2026-11-12: «Ml kit») — Poliedra Scan per Android: la pagina Scan di Personal in una
 * WebView, con lo scanner documenti di Google (ML Kit) al posto della fotocamera. Ogni «Scatta» della
 * pagina (input con capture) apre lo scanner Google; le pagine tornano alla pagina come foto già
 * raddrizzate. Condividi/Salva passano da qui perché la WebView non li sa fare. Tutto sul telefono:
 * nessun dato esce dall'app se non quando l'utente condivide o archivia.
 */
public final class MainActivity extends Activity {
    static final String ORIGIN = "https://personal.poliedrasoft.it";
    static final String AUTORITA = "it.poliedrasoft.scan.file";
    static final int REQ_SCAN = 1, REQ_FILE = 2, REQ_SALVA = 3;
    static final int MAX_PAGINE = 20, MAX_FILE = 20;
    static final long MAX_BYTES = 40L * 1024 * 1024;
    private WebView web;
    private ValueCallback<Uri[]> attesaFile;
    private WebChromeClient.FileChooserParams ultimiParametri;
    private JavaScriptReplyProxy pagina;
    private byte[] daSalvare;
    private final List<Uri> inArrivo = new ArrayList<>();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Documenti d'identità e referti: niente anteprima nelle app recenti né screenshot di sistema.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        svuota("scansioni"); svuota("condivisi");
        FrameLayout root = new FrameLayout(this);
        // Respect system bars on Android 15 edge-to-edge.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
        web = new WebView(this); root.addView(web, new FrameLayout.LayoutParams(-1, -1)); setContentView(root);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false); s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl(); if (trusted(uri)) return false;
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "mailto".equals(uri.getScheme()) || "tel".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                }
                return true;
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); }
        });
        // WebChromeClient: conferme (confirm/alert) visibili e scelta file; «Scatta» → scanner Google.
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (attesaFile != null) attesaFile.onReceiveValue(null);
                attesaFile = callback; ultimiParametri = params;
                if (params.isCaptureEnabled() && soloImmagini(params.getAcceptTypes())) {
                    avviaScanner(params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE ? MAX_PAGINE : 1);
                } else apriScelta(params);
                return true;
            }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "PoliedraScan", Collections.singleton(ORIGIN), (view, message, sourceOrigin, mainFrame, reply) -> {
                if (!mainFrame || !trusted(sourceOrigin) || !trusted(Uri.parse(view.getUrl() == null ? "" : view.getUrl()))) return;
                try { messaggio(new JSONObject(message.getData()), reply); }
                catch (Exception e) { avvisa("Operazione non riuscita: " + e.getMessage()); }
            });
        } else avvisa("Aggiorna Android System WebView: condividi e salva non sono disponibili.");
        prendi(getIntent());
        web.loadUrl(ORIGIN + "/scan/?app=android");
    }

    static boolean trusted(Uri uri) { return "https".equals(uri.getScheme()) && "personal.poliedrasoft.it".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443); }
    static boolean soloImmagini(String[] tipi) {
        if (tipi == null) return false;
        boolean qualcuno = false;
        for (String t : tipi) for (String p : t.split(",")) { p = p.trim(); if (p.isEmpty()) continue; qualcuno = true; if (!p.startsWith("image/") && !p.matches("\\.(heic|heif|jpe?g|png|webp)")) return false; }
        return qualcuno;
    }

    // ---- Scanner documenti di Google (ML Kit) ----
    private void avviaScanner(int pagine) {
        GmsDocumentScannerOptions opzioni = new GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(pagine)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build();
        GmsDocumentScanner scanner = GmsDocumentScanning.getClient(opzioni);
        scanner.getStartScanIntent(this)
            .addOnSuccessListener(sender -> {
                try { startIntentSenderForResult(sender, REQ_SCAN, null, 0, 0, 0); }
                catch (IntentSender.SendIntentException e) { senzaScanner(); }
            })
            .addOnFailureListener(e -> senzaScanner());
    }
    // Senza Google Play Services aggiornati: si usa la scelta normale (fotocamera o galleria).
    private void senzaScanner() {
        avvisa("Scanner Google non disponibile: aggiorna Google Play Services. Uso la fotocamera normale.");
        if (ultimiParametri != null) apriScelta(ultimiParametri); else rispondiFile(null);
    }
    private void apriScelta(WebChromeClient.FileChooserParams params) {
        try {
            Intent i = params.createIntent();
            if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            startActivityForResult(i, REQ_FILE);
        } catch (Exception e) { rispondiFile(null); }
    }
    private void rispondiFile(Uri[] uris) { if (attesaFile != null) attesaFile.onReceiveValue(uris); attesaFile = null; ultimiParametri = null; }

    @Override protected void onActivityResult(int req, int esito, Intent data) {
        super.onActivityResult(req, esito, data);
        if (req == REQ_SCAN) {
            GmsDocumentScanningResult r = esito == RESULT_OK ? GmsDocumentScanningResult.fromActivityResultIntent(data) : null;
            if (r == null || r.getPages() == null || r.getPages().isEmpty()) { rispondiFile(null); return; }
            List<Uri> pagine = new ArrayList<>();
            String prefisso = "scan-mlkit-" + System.currentTimeMillis() + "-";
            int n = 0;
            for (GmsDocumentScanningResult.Page p : r.getPages()) {
                n += 1;
                try { pagine.add(inCache("scansioni", prefisso + n + ".jpg", leggi(p.getImageUri()))); }
                catch (Exception e) { avvisa("Pagina " + n + " non letta."); }
            }
            rispondiFile(pagine.isEmpty() ? null : pagine.toArray(new Uri[0]));
        } else if (req == REQ_FILE) {
            if (esito != RESULT_OK || data == null) { rispondiFile(null); return; }
            ClipData clip = data.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                Uri[] uris = new Uri[clip.getItemCount()];
                for (int i = 0; i < uris.length; i++) uris[i] = clip.getItemAt(i).getUri();
                rispondiFile(uris);
            } else rispondiFile(WebChromeClient.FileChooserParams.parseResult(esito, data));
        } else if (req == REQ_SALVA) {
            byte[] dati = daSalvare; daSalvare = null;
            if (esito != RESULT_OK || data == null || data.getData() == null || dati == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) { out.write(dati); avvisa("File salvato."); }
            catch (Exception e) { avvisa("File non salvato: " + e.getMessage()); }
        }
    }

    // ---- Messaggi dalla pagina Scan (solo origine personal.poliedrasoft.it, frame principale) ----
    private void messaggio(JSONObject m, JavaScriptReplyProxy reply) throws Exception {
        String azione = m.optString("azione");
        if ("pronto".equals(azione)) { pagina = reply; consegna(); }
        else if ("condividi".equals(azione)) condividi(m.getJSONArray("files"));
        else if ("salva".equals(azione)) salva(m.getJSONObject("file"));
        else if ("traduci".equals(azione)) traduci(m.optString("id"), m.optString("testo"), m.optString("da", "auto"), m.optString("a", "en"), reply);
        else if ("ocr".equals(azione)) ocr(m.optString("id"), m.getJSONArray("immagini"), 0, new JSONArray(), reply);
        else if ("testo".equals(azione)) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, m.optString("testo"));
            startActivity(Intent.createChooser(i, "Condividi"));
        }
    }
    private void condividi(JSONArray files) throws Exception {
        if (files.length() == 0 || files.length() > MAX_FILE) throw new IOException("scegli da 1 a " + MAX_FILE + " file");
        ArrayList<Uri> uris = new ArrayList<>();
        String tipo = null;
        for (int i = 0; i < files.length(); i++) {
            JSONObject f = files.getJSONObject(i);
            uris.add(inCache("condivisi", nome(f.optString("nome", "documento")), Base64.decode(f.getString("dati"), Base64.DEFAULT)));
            String mime = f.optString("mime", "application/octet-stream");
            tipo = tipo == null || tipo.equals(mime) ? mime : "*/*";
        }
        Intent i = new Intent(uris.size() == 1 ? Intent.ACTION_SEND : Intent.ACTION_SEND_MULTIPLE);
        i.setType(tipo);
        if (uris.size() == 1) i.putExtra(Intent.EXTRA_STREAM, uris.get(0)); else i.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
        ClipData clip = ClipData.newRawUri("", uris.get(0));
        for (int k = 1; k < uris.size(); k++) clip.addItem(new ClipData.Item(uris.get(k)));
        i.setClipData(clip);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(i, "Condividi"));
    }
    private void salva(JSONObject f) {
        daSalvare = Base64.decode(f.optString("dati"), Base64.DEFAULT);
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
            .setType(f.optString("mime", "application/octet-stream")).putExtra(Intent.EXTRA_TITLE, nome(f.optString("nome", "documento")));
        startActivityForResult(i, REQ_SALVA);
    }

    // ---- SCAN-OCR-MLKIT: testo riconosciuto con ML Kit sul telefono, pagina per pagina ----
    private TextRecognizer lettore;
    private void ocr(String id, JSONArray immagini, int i, JSONArray pagine, JavaScriptReplyProxy reply) {
        try {
            if (i >= immagini.length() || i >= MAX_PAGINE * 2) {
                reply.postMessage(new JSONObject().put("tipo", "ocr").put("id", id).put("pagine", pagine).toString());
                return;
            }
            byte[] dati = Base64.decode(immagini.getString(i), Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(dati, 0, dati.length);
            if (bmp == null) throw new IOException("immagine non leggibile");
            if (lettore == null) lettore = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            int w = bmp.getWidth(), h = bmp.getHeight();
            lettore.process(InputImage.fromBitmap(bmp, 0))
                .addOnSuccessListener(testo -> {
                    try { pagine.put(pagina(testo, w, h)); bmp.recycle(); ocr(id, immagini, i + 1, pagine, reply); }
                    catch (Exception e) { erroreOcr(id, e, reply); }
                })
                .addOnFailureListener(e -> { bmp.recycle(); erroreOcr(id, e, reply); });
        } catch (Exception e) { erroreOcr(id, e, reply); }
    }
    static JSONObject pagina(Text testo, int w, int h) throws Exception {
        JSONArray parole = new JSONArray();
        StringBuilder tutto = new StringBuilder();
        for (Text.TextBlock b : testo.getTextBlocks()) {
            if (tutto.length() > 0) tutto.append("\n\n");
            boolean prima = true;
            for (Text.Line l : b.getLines()) {
                if (!prima) tutto.append('\n');
                prima = false;
                tutto.append(l.getText());
                for (Text.Element e : l.getElements()) {
                    Rect r = e.getBoundingBox();
                    if (r == null || e.getText().trim().isEmpty()) continue;
                    parole.put(new JSONObject().put("testo", e.getText()).put("x0", r.left).put("y0", r.top).put("x1", r.right).put("y1", r.bottom));
                }
            }
        }
        return new JSONObject().put("testo", tutto.toString()).put("larghezza", w).put("altezza", h).put("parole", parole);
    }
    private void erroreOcr(String id, Exception e, JavaScriptReplyProxy reply) {
        try { reply.postMessage(new JSONObject().put("tipo", "ocr").put("id", id).put("errore", String.valueOf(e.getMessage())).toString()); }
        catch (Exception ignored) { }
    }

    // ---- SCAN-TRADUCI: traduzione con ML Kit sul telefono, paragrafo per paragrafo ----
    static final int MAX_TESTO = 30000;
    private void traduci(String id, String testo, String da, String a, JavaScriptReplyProxy reply) {
        if (testo == null || testo.trim().isEmpty()) { rispostaTraduzione(id, null, null, "nessun testo", reply); return; }
        String t = testo.length() > MAX_TESTO ? testo.substring(0, MAX_TESTO) : testo;
        String arrivo = TranslateLanguage.fromLanguageTag(a);
        if (arrivo == null) { rispostaTraduzione(id, null, null, "lingua di arrivo non supportata", reply); return; }
        if (!"auto".equals(da)) { avviaTraduzione(id, t, TranslateLanguage.fromLanguageTag(da), arrivo, reply); return; }
        LanguageIdentification.getClient().identifyLanguage(t.length() > 2000 ? t.substring(0, 2000) : t)
            .addOnSuccessListener(codice -> avviaTraduzione(id, t, "und".equals(codice) ? null : TranslateLanguage.fromLanguageTag(codice), arrivo, reply))
            .addOnFailureListener(e -> rispostaTraduzione(id, null, null, "lingua non riconosciuta: " + e.getMessage(), reply));
    }
    private void avviaTraduzione(String id, String testo, String partenza, String arrivo, JavaScriptReplyProxy reply) {
        if (partenza == null) { rispostaTraduzione(id, null, null, "lingua del testo non riconosciuta: sceglila tu", reply); return; }
        if (partenza.equals(arrivo)) { rispostaTraduzione(id, testo, partenza, null, reply); return; }
        Translator traduttore = Translation.getClient(new TranslatorOptions.Builder().setSourceLanguage(partenza).setTargetLanguage(arrivo).build());
        traduttore.downloadModelIfNeeded(new DownloadConditions.Builder().build())
            .addOnSuccessListener(v -> {
                String[] paragrafi = testo.split("\n");
                String[] fatti = new String[paragrafi.length];
                paragrafo(traduttore, paragrafi, fatti, 0, () -> { traduttore.close(); rispostaTraduzione(id, String.join("\n", fatti), partenza, null, reply); },
                    e -> { traduttore.close(); rispostaTraduzione(id, null, partenza, e.getMessage(), reply); });
            })
            .addOnFailureListener(e -> { traduttore.close(); rispostaTraduzione(id, null, partenza, "modello della lingua non scaricato (serve internet la prima volta): " + e.getMessage(), reply); });
    }
    interface Fatto { void ok(); }
    interface Errore { void ko(Exception e); }
    private void paragrafo(Translator t, String[] p, String[] out, int i, Fatto fatto, Errore errore) {
        if (i >= p.length) { fatto.ok(); return; }
        if (p[i].trim().isEmpty()) { out[i] = p[i]; paragrafo(t, p, out, i + 1, fatto, errore); return; }
        t.translate(p[i]).addOnSuccessListener(r -> { out[i] = r; paragrafo(t, p, out, i + 1, fatto, errore); }).addOnFailureListener(errore::ko);
    }
    private void rispostaTraduzione(String id, String testo, String da, String errore, JavaScriptReplyProxy reply) {
        try {
            JSONObject r = new JSONObject().put("tipo", "traduzione").put("id", id);
            if (errore != null) r.put("errore", errore); else r.put("testo", testo).put("da", da);
            reply.postMessage(r.toString());
        } catch (Exception ignored) { }
    }

    // ---- PDF e foto ricevuti da altre app («Condividi» / «Apri con») ----
    private void prendi(Intent intent) {
        if (intent == null) return;
        String a = intent.getAction();
        if (Intent.ACTION_SEND.equals(a)) { Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM); if (u != null) inArrivo.add(u); }
        else if (Intent.ACTION_SEND_MULTIPLE.equals(a)) { ArrayList<Uri> l = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM); if (l != null) inArrivo.addAll(l); }
        else if (Intent.ACTION_VIEW.equals(a) && intent.getData() != null) inArrivo.add(intent.getData());
    }
    private void consegna() {
        if (pagina == null || inArrivo.isEmpty()) return;
        try {
            JSONArray files = new JSONArray();
            for (Uri u : inArrivo.subList(0, Math.min(MAX_FILE, inArrivo.size()))) {
                String mime = getContentResolver().getType(u);
                if (mime == null || !(mime.equals("application/pdf") || mime.startsWith("image/"))) continue;
                files.put(new JSONObject().put("nome", nomeDi(u, mime)).put("mime", mime).put("dati", Base64.encodeToString(leggi(u), Base64.NO_WRAP)));
            }
            inArrivo.clear();
            if (files.length() > 0) pagina.postMessage(new JSONObject().put("tipo", "file").put("files", files).toString());
        } catch (Exception e) { inArrivo.clear(); avvisa("File non aperto: " + e.getMessage()); }
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); prendi(intent); consegna(); }

    // ---- File di lavoro: solo nella cache privata dell'app, svuotata a ogni avvio ----
    private byte[] leggi(Uri u) throws IOException {
        try (InputStream in = getContentResolver().openInputStream(u); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException("file non leggibile");
            byte[] b = new byte[64 * 1024]; long tot = 0; int n;
            while ((n = in.read(b)) > 0) { tot += n; if (tot > MAX_BYTES) throw new IOException("file oltre 40 MB"); out.write(b, 0, n); }
            return out.toByteArray();
        }
    }
    private Uri inCache(String cartella, String nome, byte[] dati) throws IOException {
        File dir = new File(getCacheDir(), cartella);
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("memoria non disponibile");
        File f = new File(dir, nome);
        try (FileOutputStream out = new FileOutputStream(f)) { out.write(dati); }
        return FileProvider.getUriForFile(this, AUTORITA, f);
    }
    private void svuota(String cartella) {
        File[] files = new File(getCacheDir(), cartella).listFiles();
        if (files != null) for (File f : files) //noinspection ResultOfMethodCallIgnored
            f.delete();
    }
    static String nome(String n) {
        String pulito = n.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "").trim();
        if (pulito.isEmpty() || pulito.startsWith(".")) pulito = "documento" + pulito;
        return pulito.length() > 120 ? pulito.substring(pulito.length() - 120) : pulito;
    }
    private String nomeDi(Uri u, String mime) {
        try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst() && !c.isNull(0)) return nome(c.getString(0));
        } catch (Exception ignored) { }
        return "application/pdf".equals(mime) ? "documento.pdf" : "foto.jpg";
    }
    private void avvisa(String testo) { runOnUiThread(() -> Toast.makeText(this, testo, Toast.LENGTH_LONG).show()); }

    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (lettore != null) { lettore.close(); lettore = null; } if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
