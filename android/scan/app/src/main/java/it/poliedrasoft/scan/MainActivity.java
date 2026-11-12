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
    @Override protected void onDestroy() { if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
