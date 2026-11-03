package it.poliedrasoft.agenda;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.*;
import java.time.LocalDate;
import java.util.*;

final class AgendaStore {
    static final java.util.regex.Pattern REF = java.util.regex.Pattern.compile("[A-Za-z0-9-]{1,64}");
    static final java.util.regex.Pattern OPEN = java.util.regex.Pattern.compile("(studio|personal):[A-Za-z0-9-]{1,64}");
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("agenda", Context.MODE_PRIVATE); }
    static void clear(Context c) { prefs(c).edit().remove("snapshot").apply(); }
    static void accept(Context c, String raw) {
        try {
            if (raw == null || raw.length() > 2000000) throw new IllegalArgumentException();
            JSONObject input = new JSONObject(raw);
            if (input.optBoolean("clear")) { clear(c); AgendaWidget.refresh(c); return; }
            if (prefs(c).getBoolean("paused", false)) return;
            if (input.optInt("version") != 1) throw new IllegalArgumentException();
            LocalDate from = LocalDate.parse(input.getString("from")), to = LocalDate.parse(input.getString("to"));
            if (to.isBefore(from) || java.time.temporal.ChronoUnit.DAYS.between(from, to) > 60) throw new IllegalArgumentException();
            JSONArray source = input.getJSONArray("entries"), entries = new JSONArray();
            if (source.length() > 5000) throw new IllegalArgumentException();
            for (int i = 0; i < source.length(); i++) {
                JSONObject row = source.getJSONObject(i);
                String kind = row.getString("source");
                if (!kind.equals("studio") && !kind.equals("personal")) throw new IllegalArgumentException();
                LocalDate start = LocalDate.parse(row.getString("start")), end = LocalDate.parse(row.getString("end"));
                String time = row.optString("time");
                if (end.isBefore(start) || start.isAfter(to) || end.isBefore(from) || !time.matches("(?:[01][0-9]|2[0-3]):[0-5][0-9]|")) throw new IllegalArgumentException();
                String title = row.optString("title").replaceAll("[\\p{Cntrl}]", " ");
                // Opaque row reference for widget actions; anything else is dropped, never trusted.
                String ref = row.optString("ref");
                if (!REF.matcher(ref).matches()) ref = "";
                entries.put(new JSONObject().put("source", kind).put("ref", ref).put("start", start.toString()).put("end", end.toString())
                    .put("time", time).put("title", title.substring(0, Math.min(120, title.length()))));
            }
            // Timestamp set by native host; JS cannot prolong a snapshot's lifetime.
            JSONObject clean = new JSONObject().put("updatedAt", System.currentTimeMillis()).put("from", from.toString()).put("to", to.toString()).put("entries", entries);
            prefs(c).edit().putString("snapshot", clean.toString()).apply();
            AgendaWidget.refresh(c);
        } catch (Exception ignored) { clear(c); AgendaWidget.refresh(c); }
    }
    static JSONObject snapshot(Context c) {
        try {
            JSONObject snap = new JSONObject(prefs(c).getString("snapshot", ""));
            long age = System.currentTimeMillis() - snap.getLong("updatedAt");
            return age >= 0 && age < 86400000L ? snap : null;
        } catch (Exception ignored) { return null; }
    }
    static List<JSONObject> rows(Context c, LocalDate day, int filter) {
        List<JSONObject> rows = new ArrayList<>(); JSONObject snap = snapshot(c);
        if (snap == null) return rows;
        JSONArray source = snap.optJSONArray("entries");
        for (int i = 0; source != null && i < source.length(); i++) {
            JSONObject row = source.optJSONObject(i); if (row == null) continue;
            if (filter == 1 && !row.optString("source").equals("studio")) continue;
            if (filter == 2 && !row.optString("source").equals("personal")) continue;
            String date = day.toString();
            if (date.compareTo(row.optString("start")) >= 0 && date.compareTo(row.optString("end")) <= 0) rows.add(row);
        }
        rows.sort(Comparator.comparing(r -> r.optString("time")));
        return rows;
    }
    static LocalDate day(Context c, int id) {
        try { return LocalDate.parse(prefs(c).getString("day"+id, LocalDate.now().toString())); }
        catch (Exception ignored) { return LocalDate.now(); }
    }
    // Next item still to come: today's timed items from now on, all-day items covering today, then later days.
    static JSONObject next(Context c, java.time.LocalDateTime now) {
        JSONObject snap = snapshot(c);
        if (snap == null) return null;
        LocalDate today = now.toLocalDate(); String clock = String.format(Locale.ROOT, "%02d:%02d", now.getHour(), now.getMinute());
        LocalDate to; try { to = LocalDate.parse(snap.optString("to")); } catch (Exception ignored) { return null; }
        for (LocalDate d = today; !d.isAfter(to) && !d.isAfter(today.plusDays(28)); d = d.plusDays(1)) {
            for (JSONObject row : rows(c, d, 0)) {
                String time = row.optString("time");
                if (d.equals(today) && !time.isEmpty() && time.compareTo(clock) < 0) continue;
                try { return new JSONObject(row.toString()).put("day", d.toString()); } catch (JSONException ignored) { return null; }
            }
        }
        return null;
    }
}
