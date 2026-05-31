package cloud.helpking.doub;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;
import android.view.Menu;
import android.view.MenuItem;

import com.getcapacitor.CapacitorWebView;

/**
 * WebView subclass that hides the native/OEM text-selection floating toolbar
 * (Copy / Share / Select all / Read ...) while KEEPING the text selection and
 * its drag handles, so the user can still adjust the selection range.
 *
 * On some devices (e.g. Huawei EMUI) that toolbar is locked to a dark style and
 * renders as a black block on light themes; the web app renders its own themed
 * selection toolbar instead (see frontend SelectionToolbar).
 *
 * Why not just return null from startActionMode? Returning null makes the
 * selection controller think the selection UI failed, and on some devices it
 * drops the drag handles too (observed on Huawei). Instead we let the action
 * mode start normally (handles preserved) but wrap the callback so every menu
 * item is stripped — an action mode with an empty menu renders no toolbar.
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
        return super.startActionMode(new EmptyMenuCallback(callback));
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        return super.startActionMode(new EmptyMenuCallback(callback), type);
    }

    /**
     * Delegates the action-mode lifecycle to the original (Chromium) callback so
     * selection state stays consistent, but clears the menu so the native
     * floating toolbar has nothing to draw.
     */
    private static final class EmptyMenuCallback implements ActionMode.Callback {
        private final ActionMode.Callback delegate;

        EmptyMenuCallback(ActionMode.Callback delegate) {
            this.delegate = delegate;
        }

        @Override
        public boolean onCreateActionMode(ActionMode mode, Menu menu) {
            if (delegate != null) {
                delegate.onCreateActionMode(mode, menu);
            }
            menu.clear();
            return true;
        }

        @Override
        public boolean onPrepareActionMode(ActionMode mode, Menu menu) {
            if (delegate != null) {
                delegate.onPrepareActionMode(mode, menu);
            }
            menu.clear();
            return true;
        }

        @Override
        public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
            return false;
        }

        @Override
        public void onDestroyActionMode(ActionMode mode) {
            if (delegate != null) {
                delegate.onDestroyActionMode(mode);
            }
        }
    }
}
