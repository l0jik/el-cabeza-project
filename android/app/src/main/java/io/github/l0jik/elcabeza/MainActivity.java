package io.github.l0jik.elcabeza;

import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/* The game as an app on a phone (user: "create the app version to have on this phone."): the game's own pages,
   bundled (tools/app_www.mjs), in Capacitor's WebView.

   - Full screen from its first frame (user, of the splash: "Need the splash screen to automatically go full
     screen. That should be the first thing it does."): the status and navigation bars hidden, a swipe from an
     edge showing them a moment; drawn round a camera's notch too. Capacitor's own system bars keep them hidden
     (capacitor.config.json, SystemBars hidden).
   - The back gesture goes to the game, as a browser's Back does: the game keeps a step of its history while one's
     being played, so a Back asks before leaving it; with nothing left to go back to, the app goes to the
     background as any app does.
   - The screen kept on while the game asks it to (its Screen Wake Lock, which Android's WebView doesn't offer):
     window.ElCabezaApp.keepScreenOn(true / false), from chassis/in-app.js. */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "ElCabeza";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // (In the log, for checking the app on an emulator: made afresh or again, and its configuration.)
        Log.i(TAG, "created " + (savedInstanceState == null ? "afresh" : "again, from saved state") + ": " + getResources().getConfiguration());
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        hideBars();
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web != null) web.addJavascriptInterface(new AppScreen(), "ElCabezaApp");
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView w = getBridge() != null ? getBridge().getWebView() : null;
                if (w != null && w.canGoBack()) {
                    w.goBack();
                    return;
                }
                // (Nothing left in the game to go back to: the usual Back, the app to the background.)
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        Log.i(TAG, "configuration changed: " + newConfig);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    private void hideBars() {
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.systemBars());
    }

    /* What the game's pages can ask of the app (only the game's own pages are ever loaded in it). */
    private class AppScreen {
        @JavascriptInterface
        public void keepScreenOn(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }
    }
}
