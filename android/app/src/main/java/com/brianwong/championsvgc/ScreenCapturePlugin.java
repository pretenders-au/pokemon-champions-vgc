package com.brianwong.championsvgc;

import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "ScreenCapture")
public class ScreenCapturePlugin extends Plugin {

    @PluginMethod
    public void hasOverlayPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", Settings.canDrawOverlays(getContext()));
        call.resolve(ret);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("overlay permission not granted");
            return;
        }
        MediaProjectionManager mpm = (MediaProjectionManager)
                getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        Intent intent = mpm.createScreenCaptureIntent();
        startActivityForResult(call, intent, "projectionResult");
    }

    @ActivityCallback
    private void projectionResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("screen capture consent denied");
            return;
        }
        ScreenCaptureService.pendingBridge = getBridge();
        Intent svc = new Intent(getContext(), ScreenCaptureService.class);
        svc.putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, result.getResultCode());
        svc.putExtra(ScreenCaptureService.EXTRA_DATA, result.getData());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(svc);
        } else {
            getContext().startService(svc);
        }
        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void isSessionActive(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", ScreenCaptureService.instance != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopSession(PluginCall call) {
        ScreenCaptureService.pendingBridge = null;
        getContext().stopService(new Intent(getContext(), ScreenCaptureService.class));
        call.resolve();
    }

    @PluginMethod
    public void bringToFront(PluginCall call) {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        getContext().startActivity(intent);
        call.resolve();
    }

    /** Writes {@code text} to a cache file called {@code name} and opens the share sheet for it. */
    @PluginMethod
    public void shareFile(PluginCall call) {
        File file = new File(getContext().getCacheDir(), call.getString("name"));
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(call.getString("text").getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            call.reject("could not write " + file.getName(), e);
            return;
        }
        Uri uri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", file);
        Intent send = new Intent(Intent.ACTION_SEND)
                .setType("application/json")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        getActivity().startActivity(Intent.createChooser(send, null));
        call.resolve();
    }

    @PluginMethod
    public void capture(PluginCall call) {
        ScreenCaptureService svc = ScreenCaptureService.instance;
        if (svc == null) {
            call.reject("no active capture session");
            return;
        }
        getActivity().runOnUiThread(() -> {
            String png = svc.captureLatestPng();
            if (png == null) {
                call.reject("no frame available");
                return;
            }
            JSObject ret = new JSObject();
            ret.put("pngBase64", png);
            ret.put("width", svc.width);
            ret.put("height", svc.height);
            call.resolve(ret);
        });
    }
}
