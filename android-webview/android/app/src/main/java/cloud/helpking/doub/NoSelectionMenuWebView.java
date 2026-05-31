package cloud.helpking.doub;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;

import com.getcapacitor.CapacitorWebView;

/**
 * WebView subclass that suppresses the native/OEM text-selection floating
 * toolbar (Copy / Share / Select all / Read ...).
 *
 * On some devices (e.g. Huawei EMUI) that toolbar is locked to a dark style and
 * renders as a black block on light themes, ignoring app and system theming.
 * The web app renders its own themed selection toolbar instead
 * (see frontend SelectionToolbar).
 *
 * Returning null from startActionMode WITHOUT delegating to super prevents the
 * action mode (the toolbar) from being created at all. Crucially, NOT calling
 * super avoids the View -> DecorView path where the framework would otherwise
 * build the default selection menu as a fallback when a window callback returns
 * null. The text selection and its drag handles are unaffected — they are drawn
 * by the WebView's selection controller, not by the action mode.
 *
 * Wired in via the app-level res/layout/capacitor_bridge_layout_main.xml, which
 * overrides Capacitor's bundled layout so the bridge instantiates this class as
 * its R.id.webview.
 */
public class NoSelectionMenuWebView extends CapacitorWebView {
    public NoSelectionMenuWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback) {
        return null;
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        return null;
    }
}
