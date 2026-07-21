package hu.shiftpoint.kiosk

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var errorOverlay: LinearLayout
    private lateinit var configuredPwaUri: Uri
    private var pendingCameraRequest: PermissionRequest? = null
    private var mainFrameLoadFailed = false
    private var adminCornerTapCount = 0
    private var firstAdminCornerTapAt = 0L
    private val retryHandler = Handler(Looper.getMainLooper())
    private val retryRunnable = Runnable {
        if (errorOverlay.visibility == View.VISIBLE) {
            webView.loadUrl(getString(R.string.pwa_url))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            super.onCreate(savedInstanceState)
            startKiosk()
        } catch (error: Throwable) {
            Log.e(TAG, "Kiosk startup failed", error)
            showStartupError(error)
        }
    }

    private fun startKiosk() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val pwaUrl = getString(R.string.pwa_url)
        configuredPwaUri = Uri.parse(pwaUrl)

        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            keepScreenOn = true
        }
        errorOverlay = createNetworkErrorOverlay()

        val rootContainer = FrameLayout(this).apply {
            addView(
                webView,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
            addView(
                errorOverlay,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT
                )
            )
            addView(
                createAdminCornerHotspot(),
                FrameLayout.LayoutParams(
                    dpToPx(ADMIN_HOTSPOT_SIZE_DP),
                    dpToPx(ADMIN_HOTSPOT_SIZE_DP),
                    Gravity.TOP or Gravity.END
                )
            )
        }

        configureWebView()
        setContentView(rootContainer)
        rootContainer.post { hideSystemBars() }
        webView.loadUrl(pwaUrl)
    }

    private fun showStartupError(error: Throwable) {
        val details = error.stackTraceToString()
            .lineSequence()
            .take(12)
            .joinToString("\n")

        setContentView(TextView(this).apply {
            setBackgroundColor(Color.rgb(127, 29, 29))
            setTextColor(Color.WHITE)
            textSize = 16f
            setPadding(dpToPx(24), dpToPx(24), dpToPx(24), dpToPx(24))
            text = getString(R.string.startup_error_details, error.javaClass.name, details)
        })
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)

        if (hasFocus) {
            hideSystemBars()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode != CAMERA_PERMISSION_REQUEST_CODE) {
            return
        }

        val webRequest = pendingCameraRequest
        pendingCameraRequest = null

        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            webRequest?.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
        } else {
            webRequest?.deny()
        }
    }

    override fun onDestroy() {
        retryHandler.removeCallbacks(retryRunnable)
        pendingCameraRequest?.deny()
        pendingCameraRequest = null
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.loadUrl("about:blank")
            webView.clearHistory()
            webView.removeAllViews()
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun configureWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            builtInZoomControls = false
            displayZoomControls = false

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                safeBrowsingEnabled = true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
                mainFrameLoadFailed = false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                val finishedUri = url?.let(Uri::parse)

                if (!mainFrameLoadFailed && finishedUri != null && isTrustedPwaUri(finishedUri)) {
                    applyKioskTouchRestrictions()
                    hideNetworkError()
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                if (request.isForMainFrame) {
                    mainFrameLoadFailed = true
                    showNetworkError()
                }
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse
            ) {
                if (request.isForMainFrame && errorResponse.statusCode >= 400) {
                    mainFrameLoadFailed = true
                    showNetworkError()
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                return !isTrustedPwaUri(request.url)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    handleWebPermissionRequest(request)
                }
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest) {
                if (pendingCameraRequest == request) {
                    pendingCameraRequest = null
                }
            }
        }
    }

    private fun createNetworkErrorOverlay(): LinearLayout {
        val horizontalPadding = dpToPx(32)

        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(horizontalPadding, 0, horizontalPadding, 0)
            setBackgroundColor(Color.rgb(17, 24, 39))
            visibility = View.GONE

            addView(TextView(context).apply {
                text = getString(R.string.network_error_title)
                setTextColor(Color.WHITE)
                textSize = 28f
                gravity = Gravity.CENTER
            })
            addView(TextView(context).apply {
                text = getString(R.string.network_error_retrying)
                setTextColor(Color.LTGRAY)
                textSize = 18f
                gravity = Gravity.CENTER
                setPadding(0, dpToPx(12), 0, 0)
            })
        }
    }

    private fun createAdminCornerHotspot(): View {
        return View(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            isClickable = true
            contentDescription = null
            setOnClickListener {
                handleAdminCornerTap(this)
            }
        }
    }

    private fun handleAdminCornerTap(hotspot: View) {
        val now = SystemClock.elapsedRealtime()

        if (adminCornerTapCount == 0 || now - firstAdminCornerTapAt > ADMIN_TAP_WINDOW_MS) {
            adminCornerTapCount = 1
            firstAdminCornerTapAt = now
        } else {
            adminCornerTapCount += 1
        }

        if (adminCornerTapCount < ADMIN_REQUIRED_TAPS) {
            return
        }

        adminCornerTapCount = 0
        firstAdminCornerTapAt = 0L
        hotspot.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        Toast.makeText(this, R.string.admin_unlock_detected, Toast.LENGTH_SHORT).show()
    }

    private fun applyKioskTouchRestrictions() {
        webView.setOnLongClickListener { true }
        webView.isLongClickable = false

        webView.evaluateJavascript(
            """
            (() => {
              const styleId = "shiftpoint-android-kiosk-touch-lock";
              let style = document.getElementById(styleId);

              if (!style) {
                style = document.createElement("style");
                style.id = styleId;
                style.textContent = `
                  html, body {
                    overflow: hidden !important;
                    overscroll-behavior: none !important;
                    touch-action: none !important;
                  }
                  body.scan-only-app * {
                    pointer-events: none !important;
                    user-select: none !important;
                    -webkit-user-select: none !important;
                    -webkit-touch-callout: none !important;
                  }
                  #scanCheckInButton,
                  #scanCheckOutButton,
                  #scanCancelButton,
                  .language-btn {
                    pointer-events: auto !important;
                    touch-action: manipulation !important;
                  }
                `;
                document.head.appendChild(style);
              }

              if (!window.__shiftPointKioskTouchEventsLocked) {
                window.__shiftPointKioskTouchEventsLocked = true;
                document.addEventListener("contextmenu", event => event.preventDefault());
                document.addEventListener("dragstart", event => event.preventDefault());
                document.addEventListener("selectstart", event => event.preventDefault());
              }
            })();
            """.trimIndent(),
            null
        )
    }

    private fun showNetworkError() {
        webView.visibility = View.INVISIBLE
        errorOverlay.visibility = View.VISIBLE
        retryHandler.removeCallbacks(retryRunnable)
        retryHandler.postDelayed(retryRunnable, NETWORK_RETRY_DELAY_MS)
    }

    private fun hideNetworkError() {
        retryHandler.removeCallbacks(retryRunnable)
        errorOverlay.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun dpToPx(dp: Int): Int {
        return (dp * resources.displayMetrics.density).toInt()
    }

    private fun handleWebPermissionRequest(request: PermissionRequest) {
        val requestsCamera = request.resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)

        if (!requestsCamera || !isTrustedPwaUri(request.origin)) {
            request.deny()
            return
        }

        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
            return
        }

        pendingCameraRequest?.deny()
        pendingCameraRequest = request
        requestPermissions(
            arrayOf(Manifest.permission.CAMERA),
            CAMERA_PERMISSION_REQUEST_CODE
        )
    }

    private fun isTrustedPwaUri(uri: Uri): Boolean {
        val configuredPort = if (configuredPwaUri.port == -1) {
            configuredPwaUri.defaultPort()
        } else {
            configuredPwaUri.port
        }
        val requestedPort = if (uri.port == -1) uri.defaultPort() else uri.port

        return uri.scheme.equals(configuredPwaUri.scheme, ignoreCase = true) &&
            uri.host.equals(configuredPwaUri.host, ignoreCase = true) &&
            requestedPort == configuredPort
    }

    private fun Uri.defaultPort(): Int {
        return when (scheme?.lowercase()) {
            "https" -> 443
            "http" -> 80
            else -> -1
        }
    }

    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.apply {
                hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
            return
        }

        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }

    companion object {
        private const val TAG = "ShiftPointKiosk"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 1001
        private const val NETWORK_RETRY_DELAY_MS = 10_000L
        private const val ADMIN_REQUIRED_TAPS = 5
        private const val ADMIN_TAP_WINDOW_MS = 2_000L
        private const val ADMIN_HOTSPOT_SIZE_DP = 96
    }
}
