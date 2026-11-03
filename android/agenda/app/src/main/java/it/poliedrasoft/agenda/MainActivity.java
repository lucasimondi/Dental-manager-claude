package it.poliedrasoft.agenda;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.webkit.*;
import android.widget.*;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.time.LocalDate;
import java.util.Collections;

public final class MainActivity extends Activity {
    static final String ORIGIN = "https://personal.poliedrasoft.it";
    private WebView web;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Full-screen Poliedron agenda: no native header; screenshots allowed (PO request).
        // Widget settings (sync on/off, patient names) live in Personal > Impostazioni > Widget Android.
        FrameLayout root = new FrameLayout(this);
        // Respect system bars on Android 15 edge-to-edge.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom()); return insets;
        });
        web = new WebView(this); root.addView(web, new FrameLayout.LayoutParams(-1, -1)); setContentView(root);
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
            });
        } else { Toast.makeText(this, "Aggiorna Android System WebView per collegare i widget", Toast.LENGTH_LONG).show(); }
        open(getIntent());
    }
    static boolean trusted(Uri uri) { return "https".equals(uri.getScheme()) && "personal.poliedrasoft.it".equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443); }
    private void open(Intent intent) {
        String date; try { date = LocalDate.parse(intent.getStringExtra("day")).toString(); } catch (Exception ignored) { date = LocalDate.now().toString(); }
        String view = "settimana".equals(intent.getStringExtra("view")) ? "settimana" : "giorno";
        StringBuilder url = new StringBuilder(ORIGIN + "/?agenda=1&agendaDate=" + date + "&agendaView=" + view);
        // Widget actions only open the existing editors; Personal reads with the user's session and RLS.
        String what = intent.getBooleanExtra("new", false) ? "evento" : intent.getStringExtra("nuovo");
        String row = intent.getStringExtra("widgetOpen");
        if ("evento".equals(what) || "appuntamento".equals(what)) url.append("&widgetNew=").append(what);
        else if (row != null && AgendaStore.OPEN.matcher(row).matches()) {
            url.append("&widgetOpen=").append(Uri.encode(row));
            if ("rimanda".equals(intent.getStringExtra("widgetAction")) && row.startsWith("personal:")) url.append("&widgetAction=rimanda");
        }
        web.loadUrl(url.toString());
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); open(intent); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onDestroy() { if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
