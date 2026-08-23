package com.planner.neo;

import android.app.PendingIntent;
import android.app.Dialog;
import android.accounts.Account;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.Scope;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "NEOPlannerGoogle";
    private static final String API_BASE_URL = "https://minohlee.mooo.com";
    private static final int GOOGLE_AUTH_REQUEST = 4107;
    private static final int GOOGLE_SIGN_IN_REQUEST = 4109;
    private WebView webView;
    private final ExecutorService networkExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean googleLoginInProgress = new AtomicBoolean(false);
    private final AtomicBoolean googleRestoreAttempted = new AtomicBoolean(false);
    private volatile String googleAccessToken = "";
    private volatile GoogleSignInAccount googleAccount;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        setContentView(webView);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Native App Flag for JS environment detection
        webView.evaluateJavascript("window.isNativeApp = true;", null);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript("window.isNativeApp = true;", null);
                restoreGoogleCalendarAuthorization();
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new NativePlannerBridge(), "NativePlanner");

        // Load mobile planner interface from local assets
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private class NativePlannerBridge {
        @JavascriptInterface
        public void openExternalUrl(String url) {
            if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception error) {
                    Log.e(TAG, "외부 링크를 열지 못했습니다.", error);
                }
            });
        }

        @JavascriptInterface
        public void startGoogleCalendarLogin() {
            if (!googleLoginInProgress.compareAndSet(false, true)) return;
            if (!hasInternetConnection()) {
                finishGoogleLogin(false, "인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
                return;
            }
            int playServicesStatus = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(MainActivity.this);
            if (playServicesStatus != ConnectionResult.SUCCESS) {
                runOnUiThread(() -> {
                    if (GoogleApiAvailability.getInstance().isUserResolvableError(playServicesStatus)) {
                        Dialog dialog = GoogleApiAvailability.getInstance().getErrorDialog(MainActivity.this, playServicesStatus, 4108);
                        if (dialog != null) dialog.show();
                    }
                    finishGoogleLogin(false, "Google Play 서비스를 업데이트하거나 활성화한 뒤 다시 시도해 주세요. (" + playServicesStatus + ")");
                });
                return;
            }
            runOnUiThread(() -> {
                GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestEmail()
                    .build();
                startActivityForResult(GoogleSignIn.getClient(MainActivity.this, options).getSignInIntent(), GOOGLE_SIGN_IN_REQUEST);
            });
        }

        @JavascriptInterface
        public String getGoogleCalendarStatus() {
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(MainActivity.this);
            boolean connected = account != null && account.getGrantedScopes().contains(new Scope("https://www.googleapis.com/auth/calendar"));
            String email = account == null || account.getEmail() == null ? "" : account.getEmail();
            if (connected) getPreferences(MODE_PRIVATE).edit().putString("google_email", email).apply();
            String calendarId = getPreferences(MODE_PRIVATE).getString("google_calendar_id", "");
            String calendarName = getPreferences(MODE_PRIVATE).getString("google_calendar_name", "");
            try {
                return new JSONObject()
                    .put("connected", connected)
                    .put("email", email)
                    .put("calendarId", calendarId)
                    .put("calendarName", calendarName)
                    .put("direct", true)
                    .toString();
            } catch (Exception ignored) { return "{\"connected\":false,\"direct\":true}"; }
        }

        @JavascriptInterface
        public String getGoogleCalendars() {
            try {
                String listUrl = "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer";
                JSONObject listed = googleCalendarRequest("GET", listUrl, null);
                JSONArray items = listed.optJSONArray("items");
                JSONArray calendars = new JSONArray();
                String selectedCalendarId = getPreferences(MODE_PRIVATE).getString("google_calendar_id", "");
                if (items != null) {
                    for (int i = 0; i < items.length(); i++) {
                        JSONObject item = items.getJSONObject(i);
                        String accessRole = item.optString("accessRole", "");
                        if ("owner".equals(accessRole) || "writer".equals(accessRole)) {
                            JSONObject cal = new JSONObject();
                            cal.put("id", item.optString("id"));
                            cal.put("name", item.optString("summaryOverride", item.optString("summary", "Google 캘린더")));
                            cal.put("primary", item.optBoolean("primary", false));
                            calendars.put(cal);
                        }
                    }
                }
                return new JSONObject()
                    .put("calendars", calendars)
                    .put("selectedCalendarId", selectedCalendarId)
                    .toString();
            } catch (Exception e) {
                Log.e(TAG, "Failed to fetch Google calendars", e);
                return "{\"error\":" + JSONObject.quote(e.getMessage()) + ",\"calendars\":[]}";
            }
        }

        @JavascriptInterface
        public String setGoogleCalendarTarget(String calendarId, String calendarName) {
            getPreferences(MODE_PRIVATE).edit()
                .putString("google_calendar_id", calendarId)
                .putString("google_calendar_name", calendarName)
                .apply();
            try {
                return new JSONObject()
                    .put("success", true)
                    .put("calendarId", calendarId)
                    .put("calendarName", calendarName)
                    .toString();
            } catch (Exception e) {
                return "{\"success\":false}";
            }
        }

        @JavascriptInterface
        public String getGoogleCalendarEvents() {
            try {
                ensureAccessToken();
                String calendarId = getPreferences(MODE_PRIVATE).getString("google_calendar_id", "");
                if (calendarId.isEmpty()) return "{\"events\":[]}";
                String calendarName = getPreferences(MODE_PRIVATE).getString("google_calendar_name", "Google 캘린더");
                String encodedCalendarId = java.net.URLEncoder.encode(calendarId, "UTF-8");
                String timeMin = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Seoul")).minusYears(2).withDayOfYear(1).toInstant().toString();
                String timeMax = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Seoul")).plusYears(4).withDayOfYear(1).toInstant().toString();
                String url = "https://www.googleapis.com/calendar/v3/calendars/" + encodedCalendarId
                    + "/events?maxResults=2500&singleEvents=true&orderBy=startTime&timeMin="
                    + java.net.URLEncoder.encode(timeMin, "UTF-8") + "&timeMax=" + java.net.URLEncoder.encode(timeMax, "UTF-8");
                JSONObject listed = googleCalendarRequest("GET", url, null);
                JSONArray items = listed.optJSONArray("items");
                JSONArray events = new JSONArray();
                if (items != null) {
                    for (int i = 0; i < items.length(); i++) {
                        JSONObject item = items.getJSONObject(i);
                        if ("cancelled".equals(item.optString("status"))) continue;
                        JSONObject converted = googleEventToCalendarViewTodo(item, calendarName);
                        if (converted != null) events.put(converted);
                    }
                }
                return new JSONObject().put("events", events).toString();
            } catch (Exception e) {
                Log.e(TAG, "Failed to fetch selected Google calendar", e);
                return "{\"error\":" + JSONObject.quote(readableNetworkError(e)) + ",\"events\":[]}";
            }
        }

        @JavascriptInterface
        public String syncGoogleCalendarTodo(String todoJson) {
            try {
                ensureAccessToken();
                String calendarId = getPreferences(MODE_PRIVATE).getString("google_calendar_id", "");
                if (calendarId.isEmpty()) throw new Exception("먼저 동기화할 Google 캘린더를 선택해 주세요.");
                JSONObject todo = new JSONObject(todoJson);
                String todoId = String.valueOf(todo.opt("id"));
                String encodedCalendarId = java.net.URLEncoder.encode(calendarId, "UTF-8");
                String prefKey = "google_event_id_" + todoId;
                String googleEventId = getPreferences(MODE_PRIVATE).getString(prefKey, "");
                JSONObject event = toDirectGoogleEvent(todo, todoId);
                String action = "created";
                if (!googleEventId.isEmpty()) {
                    try {
                        googleCalendarRequest("PUT", "https://www.googleapis.com/calendar/v3/calendars/" + encodedCalendarId
                            + "/events/" + java.net.URLEncoder.encode(googleEventId, "UTF-8"), event.toString());
                        action = "updated";
                    } catch (Exception error) {
                        googleEventId = "";
                    }
                }
                if (googleEventId.isEmpty()) {
                    JSONObject created = googleCalendarRequest("POST", "https://www.googleapis.com/calendar/v3/calendars/"
                        + encodedCalendarId + "/events", event.toString());
                    googleEventId = created.optString("id");
                }
                getPreferences(MODE_PRIVATE).edit().putString(prefKey, googleEventId).apply();
                return new JSONObject().put("todoId", todoId).put("googleEventId", googleEventId).put("action", action).toString();
            } catch (Exception e) {
                Log.e(TAG, "Single Google Calendar sync failed", e);
                return "{\"error\":" + JSONObject.quote(readableNetworkError(e)) + "}";
            }
        }

    }

    private void continueGoogleCalendarLogin(GoogleSignInAccount signedInAccount) {
        googleAccount = signedInAccount;
        requestGoogleCalendarAuthorization(signedInAccount.getAccount());
    }

    private void requestGoogleCalendarAuthorization(Account account) {
        AuthorizationRequest.Builder builder = AuthorizationRequest.builder()
            .setRequestedScopes(Arrays.asList(
                new Scope("openid"),
                new Scope("email"),
                new Scope("profile"),
                new Scope("https://www.googleapis.com/auth/calendar")
            ));
        if (account != null) builder.setAccount(account);
        AuthorizationRequest request = builder.build();

        Identity.getAuthorizationClient(this).authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    PendingIntent pendingIntent = result.getPendingIntent();
                    try {
                        startIntentSenderForResult(pendingIntent.getIntentSender(), GOOGLE_AUTH_REQUEST, null, 0, 0, 0);
                    } catch (Exception error) {
                        Log.e(TAG, "Failed to show Google authorization", error);
                        finishGoogleLogin(false, "Google 계정 선택창을 열지 못했습니다.");
                    }
                } else {
                    submitGoogleAuthorization(result);
                }
            })
            .addOnFailureListener(error -> {
                Log.e(TAG, "Google authorization failed", error);
                finishGoogleLogin(false, googleApiErrorMessage(error));
            });
    }

    private void restoreGoogleCalendarAuthorization() {
        if (!googleRestoreAttempted.compareAndSet(false, true)) return;
        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(this);
        if (account == null || !account.getGrantedScopes().contains(new Scope("https://www.googleapis.com/auth/calendar"))) return;
        googleAccount = account;
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Arrays.asList(
                new Scope("openid"), new Scope("email"), new Scope("profile"),
                new Scope("https://www.googleapis.com/auth/calendar")
            ))
            .setAccount(account.getAccount())
            .build();
        Identity.getAuthorizationClient(this).authorize(request)
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) submitGoogleAuthorization(result);
            })
            .addOnFailureListener(error -> Log.w(TAG, "Google authorization restore failed", error));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == GOOGLE_SIGN_IN_REQUEST) {
            if (data == null) {
                finishGoogleLogin(false, "Google 로그인이 취소되었습니다.");
                return;
            }
            GoogleSignIn.getSignedInAccountFromIntent(data)
                .addOnSuccessListener(this::continueGoogleCalendarLogin)
                .addOnFailureListener(error -> finishGoogleLogin(false, googleApiErrorMessage(error)));
            return;
        }
        if (requestCode != GOOGLE_AUTH_REQUEST) return;
        if (data == null) {
            finishGoogleLogin(false, "Google 로그인이 취소되었습니다.");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(data);
            submitGoogleAuthorization(result);
        } catch (ApiException error) {
            Log.e(TAG, "Google consent was not completed", error);
            String detail = String.valueOf(error.getMessage());
            if (detail.contains("UNREGISTERED_ON_API_CONSOLE")) {
                finishGoogleLogin(false, "Google Cloud Android 앱 등록이 맞지 않습니다. 패키지명과 APK SHA-1을 확인해 주세요. (오류 10)");
            } else {
                finishGoogleLogin(false, resultCode == RESULT_CANCELED ? "Google 로그인이 취소되었습니다." : "Google 권한 승인에 실패했습니다. (오류 " + error.getStatusCode() + ")");
            }
        }
    }

    private void submitGoogleAuthorization(AuthorizationResult result) {
        String accessToken = result.getAccessToken();
        if (accessToken == null || accessToken.isEmpty()) {
            finishGoogleLogin(false, "Google Calendar 접근 권한을 받지 못했습니다. 다시 시도해 주세요.");
            return;
        }
        googleAccessToken = accessToken;
        GoogleSignInAccount authorizedAccount = result.toGoogleSignInAccount();
        if (authorizedAccount != null) googleAccount = authorizedAccount;
        if (googleAccount == null) googleAccount = GoogleSignIn.getLastSignedInAccount(this);
        String email = googleAccount == null ? "" : String.valueOf(googleAccount.getEmail());
        getPreferences(MODE_PRIVATE).edit().putString("google_email", "null".equals(email) ? "" : email).apply();
        getPreferences(MODE_PRIVATE).edit()
            .putString("google_calendar_id", "")
            .putString("google_calendar_name", "")
            .apply();
        finishGoogleLogin(true, "Google 계정과 Calendar가 연결되었습니다.");
    }

    private JSONObject syncDirectGoogleCalendar(JSONArray todos) throws Exception {
        String targetCalendarId = getPreferences(MODE_PRIVATE).getString("google_calendar_id", "primary");
        String encodedCalendarId = java.net.URLEncoder.encode(targetCalendarId, "UTF-8");

        String listUrl = "https://www.googleapis.com/calendar/v3/calendars/" + encodedCalendarId + "/events?maxResults=2500&singleEvents=false";
        Log.i(TAG, "Fetching Google Calendar events from: " + listUrl);
        JSONObject listed = googleCalendarRequest("GET", listUrl, null);
        JSONArray items = listed.optJSONArray("items");
        Log.i(TAG, "Fetched " + (items == null ? 0 : items.length()) + " items from Google Calendar");

        Map<String, JSONObject> remoteEventsByPlannerId = new HashMap<>();
        Map<String, JSONObject> remoteEventsByGoogleId = new HashMap<>();
        java.util.List<JSONObject> externalGoogleEvents = new java.util.ArrayList<>();

        if (items != null) {
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                if ("cancelled".equals(item.optString("status"))) continue;
                String gId = item.optString("id");
                remoteEventsByGoogleId.put(gId, item);

                JSONObject extended = item.optJSONObject("extendedProperties");
                JSONObject privateProperties = extended == null ? null : extended.optJSONObject("private");
                String todoId = privateProperties == null ? "" : privateProperties.optString("plannerTodoId", "");
                if (!todoId.isEmpty()) {
                    remoteEventsByPlannerId.put(todoId, item);
                } else {
                    externalGoogleEvents.add(item);
                }
            }
        }

        Set<String> currentPlannerIds = new HashSet<>();
        Set<String> currentGoogleIds = new HashSet<>();
        int created = 0, updated = 0, deleted = 0, imported = 0;

        for (int i = 0; i < todos.length(); i++) {
            JSONObject todo = todos.getJSONObject(i);
            String todoId = String.valueOf(todo.opt("id"));
            String googleEventId = todo.optString("googleEventId", "");
            currentPlannerIds.add(todoId);
            if (!googleEventId.isEmpty()) currentGoogleIds.add(googleEventId);

            JSONObject event = toDirectGoogleEvent(todo, todoId);
            JSONObject existing = remoteEventsByPlannerId.get(todoId);
            if (existing == null && !googleEventId.isEmpty()) {
                existing = remoteEventsByGoogleId.get(googleEventId);
            }

            if (existing == null) {
                googleCalendarRequest("POST", "https://www.googleapis.com/calendar/v3/calendars/" + encodedCalendarId + "/events", event.toString());
                created++;
            } else {
                String remoteId = existing.optString("id");
                googleCalendarRequest("PUT", "https://www.googleapis.com/calendar/v3/calendars/" + encodedCalendarId + "/events/" + java.net.URLEncoder.encode(remoteId, "UTF-8"), event.toString());
                updated++;
            }
        }

        JSONArray importedTodos = new JSONArray();
        for (JSONObject extEvent : externalGoogleEvents) {
            String gId = extEvent.optString("id");
            if (currentGoogleIds.contains(gId)) continue;

            JSONObject newTodo = googleEventToPlannerTodo(extEvent);
            if (newTodo != null) {
                importedTodos.put(newTodo);
                imported++;

                try {
                    String todoId = String.valueOf(newTodo.get("id"));
                    JSONObject patchBody = new JSONObject().put("extendedProperties", new JSONObject().put("private", new JSONObject().put("plannerTodoId", todoId).put("plannerSource", "neo-planner-android")));
                    googleCalendarRequest("PATCH", "https://www.googleapis.com/calendar/v3/calendars/" + encodedCalendarId + "/events/" + java.net.URLEncoder.encode(gId, "UTF-8"), patchBody.toString());
                } catch (Exception ignored) {}
            }
        }

        return new JSONObject()
            .put("created", created)
            .put("updated", updated)
            .put("deleted", deleted)
            .put("imported", imported)
            .put("importedTodos", importedTodos);
    }

    private JSONObject googleEventToPlannerTodo(JSONObject gEvent) {
        try {
            String title = gEvent.optString("summary", "Google 캘린더 일정");
            if (title.trim().isEmpty()) title = "Google 캘린더 일정";
            String description = gEvent.optString("description", "");
            String gId = gEvent.optString("id");

            JSONObject startObj = gEvent.optJSONObject("start");
            JSONObject endObj = gEvent.optJSONObject("end");

            String startDateTime = startObj == null ? "" : startObj.optString("dateTime", startObj.optString("date", ""));
            String endDateTime = endObj == null ? startDateTime : endObj.optString("dateTime", endObj.optString("date", startDateTime));

            boolean allDay = startObj != null && startObj.has("date") && !startObj.has("dateTime");

            if (allDay) {
                if (startDateTime.length() >= 10) startDateTime = startDateTime.substring(0, 10) + "T09:00:00+09:00";
                if (endDateTime.length() >= 10) {
                    try {
                        java.time.LocalDate endLocalDate = java.time.LocalDate.parse(endDateTime.substring(0, 10)).minusDays(1);
                        endDateTime = endLocalDate.toString() + "T18:00:00+09:00";
                    } catch (Exception e) {
                        endDateTime = startDateTime;
                    }
                }
            } else {
                startDateTime = ensureIsoDateTime(startDateTime);
                endDateTime = ensureIsoDateTime(endDateTime);
            }

            long id = System.currentTimeMillis() + (long)(Math.random() * 1000);
            return new JSONObject()
                .put("id", id)
                .put("title", title)
                .put("content", description)
                .put("startDate", startDateTime)
                .put("endDate", endDateTime)
                .put("allDay", allDay)
                .put("completed", false)
                .put("googleEventId", gId)
                .put("category", "google");
        } catch (Exception e) {
            Log.e(TAG, "Failed to convert Google event to todo", e);
            return null;
        }
    }

    private JSONObject googleEventToCalendarViewTodo(JSONObject gEvent, String calendarName) {
        try {
            JSONObject startObj = gEvent.optJSONObject("start");
            JSONObject endObj = gEvent.optJSONObject("end");
            if (startObj == null) return null;
            boolean allDay = startObj.has("date") && !startObj.has("dateTime");
            String startDate = startObj.optString("dateTime", "");
            String endDate = endObj == null ? startDate : endObj.optString("dateTime", "");
            if (allDay) {
                String startDay = startObj.optString("date", "");
                String exclusiveEndDay = endObj == null ? startDay : endObj.optString("date", startDay);
                java.time.LocalDate inclusiveEnd = java.time.LocalDate.parse(exclusiveEndDay).minusDays(1);
                startDate = startDay + "T00:00:00";
                endDate = inclusiveEnd + "T23:59:59";
            }
            JSONObject privateProperties = null;
            JSONObject extended = gEvent.optJSONObject("extendedProperties");
            if (extended != null) privateProperties = extended.optJSONObject("private");
            return new JSONObject()
                .put("id", "google:" + gEvent.optString("id"))
                .put("googleEventId", gEvent.optString("id"))
                .put("title", gEvent.optString("summary", "(제목 없음)"))
                .put("content", gEvent.optString("description", ""))
                .put("startDate", startDate)
                .put("endDate", endDate.isEmpty() ? startDate : endDate)
                .put("allDay", allDay)
                .put("completed", false)
                .put("color", "#4285f4")
                .put("scheduleType", "google")
                .put("isGoogleCalendar", true)
                .put("readOnly", true)
                .put("googleCalendarName", calendarName)
                .put("plannerTodoId", privateProperties == null ? JSONObject.NULL : privateProperties.optString("plannerTodoId", ""))
                .put("htmlLink", gEvent.optString("htmlLink", ""));
        } catch (Exception e) {
            Log.e(TAG, "Failed to convert Google calendar event", e);
            return null;
        }
    }

    private JSONObject toDirectGoogleEvent(JSONObject todo, String todoId) throws Exception {
        String summary = todo.optString("title", todo.optString("text", "일정"));
        String description = todo.optString("content", todo.optString("description", ""));
        JSONObject event = new JSONObject().put("summary", summary)
            .put("description", description)
            .put("extendedProperties", new JSONObject().put("private", new JSONObject().put("plannerTodoId", todoId).put("plannerSource", "neo-planner-android")));
        String start = todo.optString("startDate", todo.optString("date", ""));
        String end = todo.optString("endDate", start);
        if (start.isEmpty()) {
            java.time.LocalDate today = java.time.LocalDate.now();
            start = today.toString();
            end = today.toString();
        }
        if (todo.optBoolean("allDay") || start.length() <= 10) {
            String startDateStr = start.length() >= 10 ? start.substring(0, 10) : start;
            String endDateStr = end.length() >= 10 ? end.substring(0, 10) : end;
            java.time.LocalDate endDate = java.time.LocalDate.parse(endDateStr).plusDays(1);
            event.put("start", new JSONObject().put("date", startDateStr));
            event.put("end", new JSONObject().put("date", endDate.toString()));
        } else {
            event.put("start", new JSONObject().put("dateTime", ensureIsoDateTime(start)).put("timeZone", "Asia/Seoul"));
            event.put("end", new JSONObject().put("dateTime", ensureIsoDateTime(end)).put("timeZone", "Asia/Seoul"));
        }
        return event;
    }

    private String ensureIsoDateTime(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.length() == 16) trimmed += ":00";
        if (trimmed.length() == 19 && !trimmed.contains("+") && !trimmed.contains("Z")) trimmed += "+09:00";
        return trimmed;
    }

    private String ensureAccessToken() throws Exception {
        if (googleAccessToken != null && !googleAccessToken.trim().isEmpty()) {
            return googleAccessToken;
        }
        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(this);
        if (account == null) {
            throw new Exception("Google 계정이 연결되어 있지 않습니다. 다시 로그인해 주세요.");
        }
        Account androidAccount = account.getAccount();
        if (androidAccount != null) {
            try {
                String scope = "oauth2:https://www.googleapis.com/auth/calendar openid email profile";
                String token = com.google.android.gms.auth.GoogleAuthUtil.getToken(this, androidAccount, scope);
                if (token != null && !token.isEmpty()) {
                    googleAccessToken = token;
                    Log.i(TAG, "Successfully acquired access token via GoogleAuthUtil");
                    return token;
                }
            } catch (Exception e) {
                Log.w(TAG, "GoogleAuthUtil.getToken failed, falling back to AuthorizationClient", e);
            }
        }
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Arrays.asList(
                new Scope("openid"), new Scope("email"), new Scope("profile"),
                new Scope("https://www.googleapis.com/auth/calendar")
            ))
            .setAccount(account.getAccount())
            .build();

        AuthorizationResult result = com.google.android.gms.tasks.Tasks.await(
            Identity.getAuthorizationClient(this).authorize(request),
            15, java.util.concurrent.TimeUnit.SECONDS
        );
        String token = result.getAccessToken();
        if (token != null && !token.isEmpty()) {
            googleAccessToken = token;
            Log.i(TAG, "Successfully acquired access token via Identity client");
            return token;
        }
        Log.e(TAG, "AuthorizationResult token was null/empty. Has resolution: " + result.hasResolution());
        throw new Exception("Google Calendar 접근 권한 인증에 실패했습니다. 'Google 계정 연결'을 눌러 다시 로그인해 주세요.");
    }

    private JSONObject googleCalendarRequest(String method, String url, String body) throws Exception {
        String token = ensureAccessToken();
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", "application/json");
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            try (OutputStream output = connection.getOutputStream()) { output.write(body.getBytes(StandardCharsets.UTF_8)); }
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        StringBuilder text = new StringBuilder();
        if (stream != null) try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) { String line; while ((line = reader.readLine()) != null) text.append(line); }
        connection.disconnect();
        if (status < 200 || status >= 300) throw new Exception("Google Calendar API 오류 (HTTP " + status + "): " + text);
        return text.length() == 0 ? new JSONObject() : new JSONObject(text.toString());
    }

    private JSONObject requestJson(String method, String path, String jsonBody) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(API_BASE_URL + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Accept", "application/json");
        if (jsonBody != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            try (OutputStream output = connection.getOutputStream()) {
                output.write(jsonBody.getBytes(StandardCharsets.UTF_8));
            }
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        StringBuilder text = new StringBuilder();
        if (stream != null) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) text.append(line);
            }
        }
        connection.disconnect();
        JSONObject response = text.length() == 0 ? new JSONObject() : new JSONObject(text.toString());
        if (status < 200 || status >= 300) throw new Exception(response.optString("error", "Google 서버 요청에 실패했습니다.") + " (HTTP " + status + ")");
        return response;
    }

    private boolean hasInternetConnection() {
        ConnectivityManager manager = getSystemService(ConnectivityManager.class);
        if (manager == null || manager.getActiveNetwork() == null) return false;
        NetworkCapabilities capabilities = manager.getNetworkCapabilities(manager.getActiveNetwork());
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private String googleApiErrorMessage(Exception error) {
        if (error instanceof ApiException) {
            int code = ((ApiException) error).getStatusCode();
            if (code == 10) return "Google Cloud Android 앱 등록이 맞지 않습니다. 패키지명과 APK SHA-1을 확인해 주세요. (오류 10)";
            if (code == 7) return "인터넷 연결이 불안정합니다. 네트워크를 확인하고 다시 시도해 주세요. (오류 7)";
            return "Google 로그인 요청에 실패했습니다. (오류 " + code + ")";
        }
        return "Google 로그인 요청에 실패했습니다.";
    }

    private String readableNetworkError(Exception error) {
        String detail = error.getMessage();
        if (detail == null || detail.trim().isEmpty()) return "Google 로그인 서버에 연결하지 못했습니다.";
        if (detail.contains("timed out") || detail.contains("timeout")) return "Google 로그인 서버 응답이 늦습니다. 잠시 후 다시 시도해 주세요.";
        if (detail.contains("Unable to resolve host") || detail.contains("Network is unreachable")) return "인터넷 연결 또는 DNS를 확인해 주세요.";
        return detail;
    }

    private void finishGoogleLogin(boolean success, String message) {
        boolean wasExplicit = googleLoginInProgress.getAndSet(false);
        notifyGoogleLogin(success, message, wasExplicit);
    }

    private void notifyGoogleLogin(boolean success, String message, boolean wasExplicit) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String script = "window.handleNativeGoogleLoginResult(" + success + "," + JSONObject.quote(message) + "," + wasExplicit + ");";
            webView.evaluateJavascript(script, null);
        });
    }

    private void notifyGoogleSync(boolean success, String message, String importedTodosJson) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String script = "window.handleNativeGoogleSyncResult(" + success + "," + JSONObject.quote(message) + "," + (importedTodosJson == null ? "null" : JSONObject.quote(importedTodosJson)) + ");";
            webView.evaluateJavascript(script, null);
        });
    }

    @Override
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("window.handleNativeBackButton ? window.handleNativeBackButton() : false", value -> {
            if ("true".equals(value)) return;
            if (webView.canGoBack()) webView.goBack();
            else super.onBackPressed();
        });
    }

    @Override
    protected void onDestroy() {
        networkExecutor.shutdownNow();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
