package cloud.helpking.doub;

import android.app.DownloadManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import android.content.Intent;

import androidx.appcompat.app.AppCompatDelegate;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Force the native shell to day/light mode so the WebView and its
        // native text-selection toolbar/menus do not follow the system dark
        // theme. The web app manages its own light/dark theme.
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
        flushCookies();
    }

    @Override
    public void onPause() {
        flushCookies();
        super.onPause();
    }

    @Override
    public void onStop() {
        flushCookies();
        super.onStop();
    }

    private void configureWebView() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            return;
        }
        configureCookies(webView);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);
        WebSettings settings = webView.getSettings();
        disableWebViewDarkening(settings);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            handleWebViewDownload(url, userAgent, contentDisposition, mimeType, contentLength));
    }

    @SuppressWarnings("deprecation")
    private void disableWebViewDarkening(WebSettings settings) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                settings.setAlgorithmicDarkeningAllowed(false);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                settings.setForceDark(WebSettings.FORCE_DARK_OFF);
            }
        } catch (Throwable ignored) {}
    }

    private void configureCookies(WebView webView) {
        try {
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(webView, true);
            cookieManager.flush();
        } catch (Exception ignored) {}
    }

    private void flushCookies() {
        try {
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {}
    }

    private void handleWebViewDownload(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
        try {
            if (url == null || url.trim().isEmpty()) return;
            Uri uri = Uri.parse(url);
            String filename = uri.getLastPathSegment();
            if (filename == null || filename.trim().isEmpty()) filename = "doub-download";
            if (filename.contains("?")) filename = filename.substring(0, filename.indexOf('?'));
            if (mimeType != null && mimeType.startsWith("image/") && !filename.matches(".*\\.(png|jpg|jpeg|webp|gif)$")) {
                filename = filename + ".png";
            }

            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle(filename);
            request.setDescription("正在下载 " + filename);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(true);
            if (mimeType != null && !mimeType.trim().isEmpty()) request.setMimeType(mimeType);
            if (userAgent != null && !userAgent.trim().isEmpty()) request.addRequestHeader("User-Agent", userAgent);

            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager != null) {
                manager.enqueue(request);
                Toast.makeText(this, "已开始下载：" + filename, Toast.LENGTH_SHORT).show();
                return;
            }
        } catch (Exception ignored) {}
        openExternalUrl(url);
    }

    private void openExternalUrl(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
            Toast.makeText(this, "无法打开下载链接", Toast.LENGTH_LONG).show();
        }
    }
}
