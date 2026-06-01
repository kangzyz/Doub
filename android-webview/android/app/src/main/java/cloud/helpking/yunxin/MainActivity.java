package cloud.helpking.yunxin;

import android.Manifest;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

public class MainActivity extends BridgeActivity {
    private static final int LAUNCH_BACKGROUND_COLOR = 0xff171717;
    private static final String[] UPDATE_MANIFEST_URLS = new String[]{
            "https://doub.chat/downloads/update.json",
            "https://hui.helpking.cloud/downloads/update.json",
            "https://doub.chat/downloads/yunxin-update.json",
            "https://hui.helpking.cloud/downloads/yunxin-update.json"
    };
    private static final String NOTIFICATION_CHANNEL_ID = "doub_web_notifications";
    private static final int POST_NOTIFICATIONS_REQUEST_CODE = 4101;
    private static boolean updateCheckedThisProcess = false;

    private final AtomicInteger notificationId = new AtomicInteger(8000);
    private AlertDialog updateDialog;
    private Button updatePrimaryButton;
    private ProgressBar updateProgressBar;
    private TextView updateProgressText;
    private File downloadedUpdateApk;
    private OnBackPressedCallback sidebarBackCallback;
    private OnBackInvokedCallback predictiveBackCallback;
    private boolean sidebarBackCheckInFlight;
    private boolean runningDefaultBackAction;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        applyDarkLaunchSurface();
        super.onCreate(savedInstanceState);
        applyDarkLaunchSurface();
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        configureWebViewForTextInput();
        registerSidebarBackHandler();
        if (Build.VERSION.SDK_INT >= 33) {
            registerPredictiveBackHandler();
        }
        createNotificationChannel();
        getWindow().getDecorView().postDelayed(this::checkForUpdatesOnce, 3500);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (runningDefaultBackAction) {
            super.onBackPressed();
            return;
        }
        handleSidebarAwareBackPress();
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebViewForTextInput();
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

    @Override
    public void onDestroy() {
        unregisterPredictiveBackHandler();
        super.onDestroy();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event != null && event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                handleSidebarAwareBackPress();
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void configureWebViewForTextInput() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        webView.setBackgroundColor(LAUNCH_BACKGROUND_COLOR);
        configureCookies(webView);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.requestFocus(View.FOCUS_DOWN);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.addJavascriptInterface(new DoubNotificationBridge(), "DoubNotificationBridge");
        webView.evaluateJavascript(notificationPolyfillScript(), null);
        webView.setOnKeyListener((view, keyCode, event) -> {
            if (keyCode == KeyEvent.KEYCODE_BACK) {
                if (event != null && event.getAction() == KeyEvent.ACTION_UP) {
                    handleSidebarAwareBackPress();
                }
                return true;
            }
            return false;
        });
    }

    private void registerSidebarBackHandler() {
        sidebarBackCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleSidebarAwareBackPress();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, sidebarBackCallback);
    }

    private void registerPredictiveBackHandler() {
        if (Build.VERSION.SDK_INT < 33 || predictiveBackCallback != null) return;
        predictiveBackCallback = this::handleSidebarAwareBackPress;
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                predictiveBackCallback
        );
    }

    private void unregisterPredictiveBackHandler() {
        if (Build.VERSION.SDK_INT < 33 || predictiveBackCallback == null) return;
        getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(predictiveBackCallback);
        predictiveBackCallback = null;
    }

    private void handleSidebarAwareBackPress() {
        if (dispatchBackToUpdateDialogIfShowing()) return;

        WebView webView = getCurrentWebView();
        if (webView == null) {
            runDefaultBackAction();
            return;
        }
        if (sidebarBackCheckInFlight) return;

        sidebarBackCheckInFlight = true;
        try {
            webView.evaluateJavascript(openSidebarBackScript(), result -> {
                sidebarBackCheckInFlight = false;
                if (isSidebarAlreadyOpenResult(result)) {
                    runDefaultBackAction();
                }
            });
        } catch (Exception ignored) {
            sidebarBackCheckInFlight = false;
        }
    }

    @SuppressWarnings("deprecation")
    private boolean dispatchBackToUpdateDialogIfShowing() {
        if (updateDialog == null || !updateDialog.isShowing()) return false;
        updateDialog.onBackPressed();
        return true;
    }

    private WebView getCurrentWebView() {
        return getBridge() != null ? getBridge().getWebView() : null;
    }

    @SuppressWarnings("deprecation")
    private void runDefaultBackAction() {
        if (moveTaskToBack(true)) return;

        boolean callbackWasEnabled = sidebarBackCallback != null && sidebarBackCallback.isEnabled();
        runningDefaultBackAction = true;
        if (sidebarBackCallback != null) sidebarBackCallback.setEnabled(false);
        try {
            super.onBackPressed();
        } finally {
            if (sidebarBackCallback != null) sidebarBackCallback.setEnabled(callbackWasEnabled);
            runningDefaultBackAction = false;
        }
    }

    private boolean isSidebarAlreadyOpenResult(String result) {
        if (result == null) return false;
        String value = result.trim();
        if (value.length() >= 2 && value.startsWith("\"") && value.endsWith("\"")) {
            value = value.substring(1, value.length() - 1);
        }
        return "already-open".equals(value);
    }

    private String openSidebarBackScript() {
        return "(function(){" +
                "try{" +
                "function list(selector){try{return Array.prototype.slice.call(document.querySelectorAll(selector));}catch(e){return [];}}" +
                "function attr(el,name){return el&&el.getAttribute?el.getAttribute(name)||'':'';}" +
                "function text(el){return (attr(el,'aria-label')+' '+attr(el,'title')+' '+attr(el,'data-testid')+' '+attr(el,'data-test')+' '+attr(el,'data-state')+' '+attr(el,'aria-expanded')+' '+attr(el,'aria-controls')+' '+(el.textContent||'')).toLowerCase();}" +
                "function cls(el){return String(el&&el.className&&el.className.baseVal!==undefined?el.className.baseVal:el&&el.className||'').toLowerCase();}" +
                "function isVisible(el){if(!el||!el.getBoundingClientRect)return false;var s=getComputedStyle(el);var r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&s.opacity!=='0'&&r.width>8&&r.height>8&&r.bottom>0&&r.right>0&&r.top<window.innerHeight&&r.left<window.innerWidth;}" +
                "function isOpenPanel(el){if(!isVisible(el))return false;var r=el.getBoundingClientRect();var s=getComputedStyle(el);var c=cls(el);var label=text(el);var state=attr(el,'data-state').toLowerCase();var expanded=attr(el,'aria-expanded').toLowerCase();var hidden=attr(el,'aria-hidden').toLowerCase();if(hidden==='true'||state==='closed'||state==='collapsed'||expanded==='false')return false;if(/(^|\\s)(hidden|invisible)(\\s|$)|-translate-x-full|translate-x-\\[-|opacity-0|pointer-events-none/.test(c))return false;var panelLike=r.width>=140&&r.width<=Math.min(window.innerWidth,Math.max(420,window.innerWidth*0.92))&&r.height>=Math.min(480,window.innerHeight*0.55)&&r.left<Math.min(104,window.innerWidth*0.32)&&r.right>Math.min(160,window.innerWidth*0.45);var named=/sidebar|side bar|drawer|navigation|nav|menu|侧边|侧栏|菜单|导航/.test(c+' '+label);if(/drawer-open|sidebar-open|side-bar-open/.test(c)&&r.right>80&&r.left<Math.min(120,window.innerWidth*0.38))return true;if((state==='open'||expanded==='true'||/translate-x-0|\\bopen\\b|\\bshow\\b/.test(c))&&panelLike)return true;if(s.transform&&s.transform!=='none'&&r.right<=80)return false;return panelLike&&named;}" +
                "var panels=list('[data-state=\"open\"],[data-open=\"true\"],[aria-expanded=\"true\"],[aria-modal=\"true\"],[role=\"dialog\"][aria-modal=\"true\"],[class*=\"drawer-open\"],[class*=\"sidebar-open\"],[class*=\"side-bar-open\"]');" +
                "for(var i=0;i<panels.length;i++){if(isOpenPanel(panels[i]))return 'already-open';}" +
                "function interactive(el){return el&&el.closest&&el.closest('button,a,[role=\"button\"],[aria-controls],[aria-expanded],[data-state],[data-sidebar-toggle],[data-drawer-toggle]')||el;}" +
                "function fire(target,type){var r=target.getBoundingClientRect();var opts={bubbles:true,cancelable:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2};try{if(type.indexOf('pointer')===0&&window.PointerEvent){opts.pointerId=1;opts.pointerType='touch';opts.isPrimary=true;target.dispatchEvent(new PointerEvent(type,opts));return true;}target.dispatchEvent(new MouseEvent(type,opts));return true;}catch(e){try{target.dispatchEvent(new Event(type,{bubbles:true,cancelable:true}));return true;}catch(ignored){return false;}}}" +
                "function click(el){var target=interactive(el);if(!isVisible(target))return false;try{target.focus({preventScroll:true});}catch(e){}var fired=false;fired=fire(target,'pointerdown')||fired;fired=fire(target,'mousedown')||fired;fired=fire(target,'pointerup')||fired;fired=fire(target,'mouseup')||fired;fired=fire(target,'click')||fired;return fired;}" +
                "function nearTopLeft(el){var r=el.getBoundingClientRect();return r.left<Math.min(128,window.innerWidth*0.4)&&r.top<Math.min(144,window.innerHeight*0.25)&&r.width<=96&&r.height<=96;}" +
                "function hasMenuSvg(el){if(!el||!el.querySelector)return false;var svgs=Array.prototype.slice.call(el.querySelectorAll('svg'));for(var i=0;i<svgs.length;i++){var v=svgs[i];var c=cls(v);var label=text(v);if(/lucide-menu|\\bmenu\\b|bars|hamburger/.test(c+' '+label+' '+attr(v,'data-lucide')+' '+attr(v,'data-icon')))return true;var lines=v.querySelectorAll?Array.prototype.slice.call(v.querySelectorAll('line')):[];if(nearTopLeft(v)&&lines.length>=2&&lines.length<=4)return true;}return false;}" +
                "function excludedText(el,withText){return (attr(el,'aria-label')+' '+attr(el,'title')+' '+attr(el,'data-testid')+' '+attr(el,'data-test')+' '+attr(el,'role')+' '+cls(el)+' '+(withText?(el.textContent||''):'')).toLowerCase();}" +
                "function fileInputRelated(el){if(!el)return false;if(el.matches&&el.matches('input[type=\"file\"]'))return true;if(el.querySelector&&el.querySelector('input[type=\"file\"]'))return true;var label=el.closest&&el.closest('label');if(label){if(label.querySelector&&label.querySelector('input[type=\"file\"]'))return true;var id=attr(label,'for');if(id){var input=document.getElementById(id);if(input&&input.matches&&input.matches('input[type=\"file\"]'))return true;}}return false;}" +
                "function excludedControl(el){if(fileInputRelated(el))return true;var s=excludedText(el,true);if(el&&el.querySelectorAll){var kids=Array.prototype.slice.call(el.querySelectorAll('[aria-label],[title],[data-testid],[data-test],[role],[class],svg')).slice(0,24);for(var i=0;i<kids.length;i++){s+=' '+excludedText(kids[i],true);}}var p=el&&el.parentElement;for(var j=0;j<3&&p;j++,p=p.parentElement){s+=' '+excludedText(p,false);}return /upload|attachment|attach|paperclip|plus|image|photo|camera|microphone|emoji|composer|输入|上传|文件|附件|图片|相机|语音|表情|添加|(^|[^a-z])file([^a-z]|$)|(^|[^a-z])add([^a-z]|$)|(^|[^a-z])mic([^a-z]|$)/.test(s);}" +
                "function sideLabel(s){return /sidebar|side bar|drawer|navigation|\\bnav\\b|open sidebar|toggle sidebar|侧边|侧栏|导航/.test(s);}" +
                "function menuLabel(s){return /\\bmenu\\b|hamburger|菜单/.test(s);}" +
                "function allowedButton(el){if(excludedControl(el)||!isVisible(el))return false;var label=(text(el)+' '+cls(el)+' '+attr(el,'role')).toLowerCase();var stateClosed=attr(el,'aria-expanded').toLowerCase()==='false'||attr(el,'data-state').toLowerCase()==='closed'||attr(el,'data-state').toLowerCase()==='collapsed';if(/close|关闭|收起/.test(label)&&!/toggle|切换|menu|菜单/.test(label))return false;if(sideLabel(label))return true;if(nearTopLeft(el)&&(menuLabel(label)||hasMenuSvg(el)))return true;if(stateClosed&&nearTopLeft(el)&&(menuLabel(label)||hasMenuSvg(el)))return true;return false;}" +
                "var selector='button[aria-controls*=\"sidebar\"],button[aria-controls*=\"drawer\"],button[aria-controls*=\"nav\"],[role=\"button\"][aria-controls*=\"sidebar\"],[role=\"button\"][aria-controls*=\"drawer\"],[role=\"button\"][aria-controls*=\"nav\"],button[aria-label*=\"sidebar\"],button[aria-label*=\"Sidebar\"],button[aria-label*=\"drawer\"],button[aria-label*=\"Drawer\"],button[aria-label*=\"menu\"],button[aria-label*=\"Menu\"],button[aria-label*=\"navigation\"],button[aria-label*=\"Navigation\"],button[aria-label*=\"菜单\"],button[aria-label*=\"侧边\"],button[aria-label*=\"导航\"],button[title*=\"sidebar\"],button[title*=\"Sidebar\"],button[title*=\"drawer\"],button[title*=\"Drawer\"],button[title*=\"menu\"],button[title*=\"Menu\"],button[title*=\"navigation\"],button[title*=\"Navigation\"],button[title*=\"菜单\"],button[title*=\"侧边\"],button[data-testid*=\"sidebar\"],button[data-testid*=\"drawer\"],button[data-testid*=\"menu\"],button[data-testid*=\"nav\"],button[data-test*=\"sidebar\"],button[data-test*=\"drawer\"],button[data-test*=\"menu\"],button[data-test*=\"nav\"],[data-sidebar-toggle],[data-drawer-toggle]';" +
                "var controls=list(selector);" +
                "for(var j=0;j<controls.length;j++){if(allowedButton(controls[j])&&click(controls[j]))return 'opened';}" +
                "var fallback=list('button,[role=\"button\"],a[role=\"button\"]');" +
                "for(var f=0;f<fallback.length;f++){if(nearTopLeft(fallback[f])&&allowedButton(fallback[f])&&click(fallback[f]))return 'opened';}" +
                "var icons=list('svg.lucide-menu,svg[class*=\"lucide-menu\"],svg[class*=\"lucide\"][class*=\"menu\"],svg[class*=\"menu\"],svg[class*=\"Menu\"],svg[data-lucide=\"menu\"],svg[data-icon*=\"menu\"],svg[data-icon*=\"bars\"],svg[aria-label*=\"menu\"],svg[aria-label*=\"Menu\"]');" +
                "for(var k=0;k<icons.length;k++){var iconTarget=interactive(icons[k]);if(nearTopLeft(icons[k])&&allowedButton(iconTarget)&&click(icons[k]))return 'opened';}" +
                "return 'missing';" +
                "}catch(e){return 'error';}" +
                "})();";
    }

    private void applyDarkLaunchSurface() {
        Window window = getWindow();
        window.setBackgroundDrawable(new ColorDrawable(LAUNCH_BACKGROUND_COLOR));
        window.setStatusBarColor(LAUNCH_BACKGROUND_COLOR);
        window.setNavigationBarColor(LAUNCH_BACKGROUND_COLOR);
        window.getDecorView().setBackgroundColor(LAUNCH_BACKGROUND_COLOR);

        int flags = window.getDecorView().getSystemUiVisibility();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }
        window.getDecorView().setSystemUiVisibility(flags);
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

    private String notificationPolyfillScript() {
        return "(function(){" +
                "if(window.__doubAndroidNotificationPolyfill)return;" +
                "window.__doubAndroidNotificationPolyfill=true;" +
                "if(!window.DoubNotificationBridge)return;" +
                "var bridge=window.DoubNotificationBridge;" +
                "var permission=bridge.getPermission();" +
                "function AndroidNotification(title,options){" +
                "options=options||{};" +
                "this.title=String(title||'DOUB');" +
                "this.body=options.body||'';" +
                "this.tag=options.tag||'';" +
                "this.icon=options.icon||'';" +
                "this.onclick=null;this.onclose=null;this.onerror=null;this.onshow=null;" +
                "if(AndroidNotification.permission==='granted'){bridge.show(this.title,String(this.body||''),String(this.tag||''),String(this.icon||''));" +
                "var self=this;setTimeout(function(){if(typeof self.onshow==='function')self.onshow();},0);}" +
                "}" +
                "AndroidNotification.permission=permission;" +
                "AndroidNotification.maxActions=0;" +
                "AndroidNotification.requestPermission=function(callback){" +
                "return new Promise(function(resolve){" +
                "var result=bridge.requestPermission();" +
                "AndroidNotification.permission=result;" +
                "if(typeof callback==='function')callback(result);" +
                "resolve(result);" +
                "});" +
                "};" +
                "AndroidNotification.prototype.close=function(){if(typeof this.onclose==='function')this.onclose();};" +
                "window.Notification=AndroidNotification;" +
                "})();";
    }

    private class DoubNotificationBridge {
        @JavascriptInterface
        public String getPermission() {
            return hasNotificationPermission() ? "granted" : "default";
        }

        @JavascriptInterface
        public String requestPermission() {
            if (hasNotificationPermission()) return "granted";
            if (Build.VERSION.SDK_INT >= 33) {
                runOnUiThread(() -> ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        POST_NOTIFICATIONS_REQUEST_CODE
                ));
                return hasNotificationPermission() ? "granted" : "default";
            }
            return "granted";
        }

        @JavascriptInterface
        public void show(String title, String body, String tag, String icon) {
            runOnUiThread(() -> showNativeNotification(title, body, tag));
        }
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "DOUB 通知",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("DOUB 回复完成与应用提醒");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void showNativeNotification(String title, String body, String tag) {
        if (!hasNotificationPermission()) {
            if (Build.VERSION.SDK_INT >= 33) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, POST_NOTIFICATIONS_REQUEST_CODE);
            }
            return;
        }
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                Math.abs((tag == null ? "" : tag).hashCode()),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String safeTitle = title == null || title.trim().isEmpty() ? "DOUB" : title.trim();
        String safeBody = body == null ? "" : body.trim();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle(safeTitle)
                .setContentText(safeBody)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(safeBody))
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT);
        try {
            NotificationManagerCompat.from(this).notify(notificationId.incrementAndGet(), builder.build());
        } catch (SecurityException ignored) {
        }
    }

    private void checkForUpdatesOnce() {
        if (updateCheckedThisProcess) return;
        updateCheckedThisProcess = true;
        new Thread(() -> {
            for (String manifestUrl : UPDATE_MANIFEST_URLS) {
                HttpURLConnection connection = null;
                try {
                    URL url = new URL(manifestUrl + "?t=" + System.currentTimeMillis());
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(8000);
                    connection.setReadTimeout(8000);
                    connection.setRequestMethod("GET");
                    connection.setRequestProperty("Accept", "application/json");
                    if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) continue;

                    String rawManifest = readAll(connection.getInputStream()).trim();
                    if (!rawManifest.startsWith("{")) continue;
                    JSONObject manifest = new JSONObject(rawManifest);
                    int latestVersionCode = manifest.optInt("versionCode", 0);
                    int currentVersionCode = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
                    if (latestVersionCode <= currentVersionCode) return;

                    String latestVersionName = manifest.optString("versionName", "新版");
                    String apkUrl = manifest.optString("apkUrl", "https://hui.helpking.cloud/downloads/YunXin-release.apk");
                    String releaseNotes = manifest.optString("releaseNotes", "发现新版本，建议更新。");
                    long size = manifest.optLong("size", 0L);
                    boolean force = manifest.optBoolean("force", false);
                    runOnUiThread(() -> showUpdateDialog(latestVersionName, releaseNotes, apkUrl, size, force));
                    return;
                } catch (Exception ignored) {
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }
        }).start();
    }

    private String readAll(InputStream inputStream) throws Exception {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }

    private void showUpdateDialog(String latestVersionName, String releaseNotes, String apkUrl, long size, boolean force) {
        downloadedUpdateApk = null;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int padding = dp(20);
        root.setPadding(padding, padding, padding, padding / 2);

        TextView title = new TextView(this);
        title.setText("发现新版本 " + latestVersionName);
        title.setTextSize(20);
        title.setTextColor(0xff111827);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        root.addView(title, new LinearLayout.LayoutParams(-1, -2));

        TextView sizeView = new TextView(this);
        sizeView.setText(size > 0 ? "安装包大小：" + formatBytes(size) : "安装包大小：正在获取");
        sizeView.setTextSize(13);
        sizeView.setTextColor(0xff6b7280);
        LinearLayout.LayoutParams sizeParams = new LinearLayout.LayoutParams(-1, -2);
        sizeParams.setMargins(0, dp(8), 0, dp(8));
        root.addView(sizeView, sizeParams);

        ScrollView scrollView = new ScrollView(this);
        TextView notes = new TextView(this);
        notes.setText(releaseNotes);
        notes.setTextSize(14);
        notes.setTextColor(0xff374151);
        notes.setLineSpacing(2, 1.05f);
        scrollView.addView(notes);
        LinearLayout.LayoutParams notesParams = new LinearLayout.LayoutParams(-1, dp(160));
        root.addView(scrollView, notesParams);

        updateProgressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        updateProgressBar.setMax(100);
        updateProgressBar.setProgress(0);
        updateProgressBar.setVisibility(View.GONE);
        LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(-1, -2);
        barParams.setMargins(0, dp(14), 0, 0);
        root.addView(updateProgressBar, barParams);

        updateProgressText = new TextView(this);
        updateProgressText.setText("");
        updateProgressText.setTextSize(12);
        updateProgressText.setTextColor(0xff6b7280);
        updateProgressText.setVisibility(View.GONE);
        root.addView(updateProgressText, new LinearLayout.LayoutParams(-1, -2));

        AlertDialog.Builder builder = new AlertDialog.Builder(this)
                .setView(root)
                .setCancelable(!force)
                .setPositiveButton("立即下载", null);
        if (!force) builder.setNegativeButton("稍后", null);

        updateDialog = builder.create();
        updateDialog.setOnShowListener(dialog -> {
            updatePrimaryButton = updateDialog.getButton(AlertDialog.BUTTON_POSITIVE);
            updatePrimaryButton.setOnClickListener(v -> {
                if (downloadedUpdateApk != null && downloadedUpdateApk.exists()) {
                    installApk(downloadedUpdateApk);
                } else {
                    startUpdateDownload(apkUrl, latestVersionName);
                }
            });
        });
        updateDialog.show();
    }

    private void startUpdateDownload(String apkUrl, String latestVersionName) {
        if (updatePrimaryButton != null) {
            updatePrimaryButton.setEnabled(false);
            updatePrimaryButton.setText("下载中…");
        }
        if (updateProgressBar != null) {
            updateProgressBar.setVisibility(View.VISIBLE);
            updateProgressBar.setIndeterminate(true);
        }
        if (updateProgressText != null) {
            updateProgressText.setVisibility(View.VISIBLE);
            updateProgressText.setText("正在连接下载服务器…");
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            File output = null;
            try {
                URL url = new URL(apkUrl + (apkUrl.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis());
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(20000);
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/vnd.android.package-archive,*/*");
                int code = connection.getResponseCode();
                if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
                long total = connection.getContentLengthLong();
                File dir = getExternalFilesDir(null);
                if (dir == null) dir = getCacheDir();
                output = new File(dir, "DOUB-" + latestVersionName.replaceAll("[^0-9A-Za-z._-]", "_") + ".apk");
                byte[] buffer = new byte[64 * 1024];
                long downloaded = 0;
                try (InputStream input = new BufferedInputStream(connection.getInputStream());
                     FileOutputStream fileOutput = new FileOutputStream(output)) {
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        fileOutput.write(buffer, 0, read);
                        downloaded += read;
                        long finalDownloaded = downloaded;
                        runOnUiThread(() -> updateDownloadProgress(finalDownloaded, total));
                    }
                    fileOutput.flush();
                }
                if (!output.exists() || output.length() <= 0) throw new Exception("empty apk");
                final File completedApk = output;
                final long completedSize = completedApk.length();
                downloadedUpdateApk = completedApk;
                runOnUiThread(() -> {
                    updateDownloadProgress(completedSize, completedSize);
                    if (updatePrimaryButton != null) {
                        updatePrimaryButton.setEnabled(true);
                        updatePrimaryButton.setText("安装更新");
                    }
                    Toast.makeText(this, "下载完成，正在打开安装器", Toast.LENGTH_SHORT).show();
                    installApk(completedApk);
                });
            } catch (Exception e) {
                if (output != null && output.exists()) output.delete();
                runOnUiThread(() -> {
                    if (updateProgressBar != null) updateProgressBar.setIndeterminate(false);
                    if (updateProgressText != null) updateProgressText.setText("下载失败，请检查网络后重试");
                    if (updatePrimaryButton != null) {
                        updatePrimaryButton.setEnabled(true);
                        updatePrimaryButton.setText("重新下载");
                    }
                    Toast.makeText(this, "下载失败，请稍后重试", Toast.LENGTH_LONG).show();
                });
            } finally {
                if (connection != null) connection.disconnect();
            }
        }).start();
    }

    private void updateDownloadProgress(long downloaded, long total) {
        if (updateProgressBar == null || updateProgressText == null) return;
        updateProgressBar.setVisibility(View.VISIBLE);
        updateProgressText.setVisibility(View.VISIBLE);
        if (total > 0) {
            int percent = (int) Math.min(100, Math.max(0, downloaded * 100 / total));
            updateProgressBar.setIndeterminate(false);
            updateProgressBar.setProgress(percent);
            updateProgressText.setText("已下载 " + percent + "% · " + formatBytes(downloaded) + " / " + formatBytes(total));
        } else {
            updateProgressBar.setIndeterminate(true);
            updateProgressText.setText("已下载 " + formatBytes(downloaded));
        }
    }

    private void installApk(File apkFile) {
        if (apkFile == null || !apkFile.exists() || apkFile.length() <= 0) {
            Toast.makeText(this, "安装包不存在，请重新下载", Toast.LENGTH_LONG).show();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            showInstallPermissionDialog(apkFile);
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(uri);
            intent.putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true);
            intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            tryFallbackInstallIntent(apkFile);
        } catch (Exception e) {
            Toast.makeText(this, "无法打开安装器，请检查安装未知应用权限", Toast.LENGTH_LONG).show();
        }
    }

    private void tryFallbackInstallIntent(File apkFile) {
        try {
            Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "无法打开安装器，请检查安装未知应用权限", Toast.LENGTH_LONG).show();
        }
    }

    private void showInstallPermissionDialog(File apkFile) {
        new AlertDialog.Builder(this)
                .setTitle("需要安装权限")
                .setMessage("安卓系统需要允许 DOUB 安装未知来源应用。请在打开的设置页中开启权限，然后返回 DOUB 点击“安装更新”。")
                .setPositiveButton("去开启", (dialog, which) -> openInstallPermissionSettings())
                .setNegativeButton("稍后", null)
                .show();
        if (updatePrimaryButton != null) {
            updatePrimaryButton.setEnabled(true);
            updatePrimaryButton.setText("安装更新");
            updatePrimaryButton.setOnClickListener(v -> installApk(apkFile));
        }
    }

    private void openInstallPermissionSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception e) {
            try {
                startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
            } catch (Exception ignored) {
                Toast.makeText(this, "无法打开权限设置", Toast.LENGTH_LONG).show();
            }
        }
    }

    private String formatBytes(long bytes) {
        if (bytes <= 0) return "未知";
        double value = bytes;
        String[] units = new String[]{"B", "KB", "MB", "GB"};
        int unit = 0;
        while (value >= 1024 && unit < units.length - 1) {
            value /= 1024;
            unit++;
        }
        return String.format(Locale.US, unit == 0 ? "%.0f %s" : "%.1f %s", value, units[unit]);
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }
}
