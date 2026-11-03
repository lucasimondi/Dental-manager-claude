package it.poliedrasoft.agenda;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.widget.*;
import android.view.WindowManager;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.time.LocalDate;
import java.util.Collections;

public final class MainActivity extends Activity {
    static final String ORIGIN = "https://personal.poliedrasoft.it";
    private WebView web;
    private TextView status;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);
        // Respect system bars on Android 15 edge-to-edge.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
        status = new TextView(this); status.setPadding(16, 8, 16, 8);
        status.setText("Collega l’agenda · Widget aggiornati mentre l’app è aperta"); root.addView(status);
        Button clear = new Button(this); clear.setText(AgendaStore.prefs(this).getBoolean("paused",false) ? "Collega widget" : "Scollega e svuota widget");
        clear.setOnClickListener(v -> {
            boolean paused = !AgendaStore.prefs(this).getBoolean("paused",false);
            AgendaStore.prefs(this).edit().putBoolean("paused",paused).apply(); AgendaStore.clear(this); AgendaWidget.refresh(this);
            clear.setText(paused ? "Collega widget" : "Scollega e svuota widget");
            status.setText(paused ? "Widget scollegati e svuotati" : "Collegamento widget in corso…");
            if (!paused) web.reload();
        }); root.addView(clear);
        web = new WebView(this); root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(root);
        web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(false);
        web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl(); if (trusted(uri)) return false;
                // External destinations never enter the WebView or receive the native bridge.
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "mailto".equals(uri.getScheme()) || "tel".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                }
                return true;
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) { handler.cancel(); }
        });
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "PoliedraWidget", Collections.singleton(ORIGIN), (view, message, sourceOrigin, mainFrame, reply) -> {
                if (!mainFrame || !trusted(sourceOrigin) || !trusted(Uri.parse(view.getUrl() == null ? "" : view.getUrl()))) return;
                AgendaStore.accept(this, message.getData());
                status.setText(AgendaStore.snapshot(this) == null ? "Collega l’agenda dello studio per aggiornare i widget" : "Widget aggiornati · Giorno e Settimana disponibili nella Home Android");
            });
        } else { status.setText("Aggiorna Android System WebView per collegare i widget"); }
        open(getIntent());
    }
    static boolean trusted(Uri uri) { return "https".equals(uri.getScheme()) && "personal.poliedrasoft.it".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443); }
    private void open(Intent intent) {
        String date; try { date = LocalDate.parse(intent.getStringExtra("day")).toString(); } catch (Exception ignored) { date = LocalDate.now().toString(); }
        String view = "settimana".equals(intent.getStringExtra("view")) ? "settimana" : "giorno";
        web.loadUrl(ORIGIN + "/?agenda=1&agendaDate=" + date + "&agendaView=" + view + (intent.getBooleanExtra("new",false) ? "&widgetNew=1" : ""));
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); open(intent); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
