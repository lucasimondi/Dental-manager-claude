package it.poliedrasoft.agenda;

import android.app.PendingIntent;
import android.appwidget.*;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.json.JSONObject;

public class AgendaWidget extends AppWidgetProvider {
    private static final int[] DAYS = { R.id.day0, R.id.day1, R.id.day2, R.id.day3, R.id.day4, R.id.day5, R.id.day6 };
    private static final Locale IT = Locale.ITALIAN;
    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (Class<?> klass : new Class<?>[]{ DayWidget.class, WeekWidget.class }) for (int id : m.getAppWidgetIds(new ComponentName(c, klass))) render(c, m, id, klass == WeekWidget.class);
        for (int id : m.getAppWidgetIds(new ComponentName(c, QuickWidget.class))) QuickWidget.render(c, m, id);
    }
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) render(c, m, id, this instanceof WeekWidget); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) { render(c, m, id, this instanceof WeekWidget); }
    @Override public void onDeleted(Context c, int[] ids) {
        var edit = AgendaStore.prefs(c).edit(); for (int id : ids) for (String key : new String[]{"day", "filter", "details"}) edit.remove(key+id); edit.apply();
    }
    @Override public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        if (!"it.poliedrasoft.agenda.NAV".equals(intent.getAction())) return;
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
        AppWidgetManager manager = AppWidgetManager.getInstance(c);
        AppWidgetProviderInfo info = manager.getAppWidgetInfo(id);
        if (info == null || !info.provider.getPackageName().equals(c.getPackageName())) return;
        boolean week = WeekWidget.class.getName().equals(info.provider.getClassName());
        var prefs = AgendaStore.prefs(c); var edit = prefs.edit(); LocalDate day = AgendaStore.day(c, id);
        String action = intent.getStringExtra("nav");
        if ("prev".equals(action)) day = day.minusDays(week ? 7 : 1);
        else if ("next".equals(action)) day = day.plusDays(week ? 7 : 1);
        else if ("today".equals(action)) day = LocalDate.now();
        else if ("select".equals(action)) { try { day = LocalDate.parse(intent.getStringExtra("day")); } catch (Exception ignored) { return; } }
        else if ("filter".equals(action)) edit.putInt("filter"+id, (prefs.getInt("filter"+id, 0)+1)%3);
        else if ("privacy".equals(action)) edit.putBoolean("details"+id, !prefs.getBoolean("details"+id, false));
        edit.putString("day"+id, day.toString()).apply(); render(c, manager, id, week);
    }
    private static PendingIntent nav(Context c, int id, boolean week, String action, String date) {
        Intent i = new Intent(c, week ? WeekWidget.class : DayWidget.class).setAction("it.poliedrasoft.agenda.NAV")
            .setData(Uri.parse("poliedra-widget://"+id+"/"+action+"/"+date)).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id).putExtra("nav",action).putExtra("day",date);
        return PendingIntent.getBroadcast(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static PendingIntent open(Context c, int id, LocalDate day, boolean week, boolean mutable) {
        // Distinct data per view and purpose: PendingIntents with equal data would overwrite each other's extras.
        Intent i = new Intent(c, MainActivity.class).setData(Uri.parse("poliedra-agenda://"+id+"/"+(week ? "settimana" : "giorno")+"/"+(mutable ? "row" : "open")+"/"+day)).putExtra("day", day.toString()).putExtra("view", week ? "settimana" : "giorno");
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | (mutable ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE));
    }
    // New personal event ("evento") or Studio appointment ("appuntamento") on a date: opens the existing editor, never saves.
    static PendingIntent create(Context c, int id, LocalDate day, String what) {
        Intent i = new Intent(c, MainActivity.class).setData(Uri.parse("poliedra-new://"+id+"/"+what+"/"+day)).putExtra("day", day.toString()).putExtra("nuovo", what);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void render(Context c, AppWidgetManager m, int id, boolean week) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget);
        LocalDate day = AgendaStore.day(c,id), monday = day.minusDays(day.getDayOfWeek().getValue()-1);
        var prefs = AgendaStore.prefs(c); int filter = prefs.getInt("filter"+id,0);
        r.setTextViewText(R.id.title, week ? "Poliedra · Settimana" : "Poliedra · Giorno");
        r.setTextViewText(R.id.period, week ? monday.format(DateTimeFormatter.ofPattern("d MMM",IT))+" – "+monday.plusDays(6).format(DateTimeFormatter.ofPattern("d MMM yyyy",IT)) : day.format(DateTimeFormatter.ofPattern("EEEE d MMMM", IT)));
        r.setViewVisibility(R.id.week, week ? View.VISIBLE : View.GONE);
        for (int i=0;i<7;i++) {
            LocalDate d = monday.plusDays(i); int count = AgendaStore.rows(c,d,filter).size();
            r.setTextViewText(DAYS[i], d.format(DateTimeFormatter.ofPattern("EE",IT))+"\n"+d.getDayOfMonth()+(count>0 ? " ·"+count : ""));
            r.setInt(DAYS[i], "setBackgroundColor", d.equals(day) ? 0xFFD7EFED : 0x00FFFFFF);
            r.setOnClickPendingIntent(DAYS[i],nav(c,id,week,"select",d.toString()));
            r.setContentDescription(DAYS[i],d.format(DateTimeFormatter.ofPattern("EEEE d MMMM",IT))+", "+count+" impegni");
        }
        for (String a : new String[]{"prev","next","today","filter","privacy"}) {
            int view = switch(a) { case "prev" -> R.id.prev; case "next" -> R.id.next; case "today" -> R.id.today; case "filter" -> R.id.filter; default -> R.id.privacy; };
            r.setOnClickPendingIntent(view,nav(c,id,week,a,day.toString()));
        }
        r.setTextViewText(R.id.filter,new String[]{"Tutti · Studio + Personale","● Studio","● Personale"}[filter]);
        r.setTextViewText(R.id.privacy,prefs.getBoolean("details"+id,false) ? "Nascondi" : "Dettagli");
        JSONObject snap = AgendaStore.snapshot(c);
        boolean covered = snap != null && day.toString().compareTo(snap.optString("from"))>=0 && day.toString().compareTo(snap.optString("to"))<=0;
        boolean empty = !covered || AgendaStore.rows(c,day,filter).isEmpty();
        r.setViewVisibility(R.id.empty,empty ? View.VISIBLE : View.GONE); r.setViewVisibility(R.id.list,empty ? View.GONE : View.VISIBLE);
        r.setTextViewText(R.id.empty,!covered ? "Apri l’app per aggiornare questo periodo" : "Nessun impegno · "+day.format(DateTimeFormatter.ofPattern("EEE d",IT)));
        String updated = snap == null ? "Da collegare" : "Agg. "+java.time.Instant.ofEpochMilli(snap.optLong("updatedAt")).atZone(java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("dd/MM HH:mm",IT));
        r.setTextViewText(R.id.status,updated+" · tocca qui per aggiornare");
        r.setOnClickPendingIntent(R.id.status,open(c,id,day,week,false));
        Intent adapter = new Intent(c,AgendaService.class).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,id).setData(Uri.parse("poliedra-list://"+id));
        r.setRemoteAdapter(R.id.list,adapter);
        r.setPendingIntentTemplate(R.id.list,open(c,id,day,week,true));
        r.setOnClickPendingIntent(R.id.open,open(c,id,day,week,false)); r.setOnClickPendingIntent(R.id.empty,open(c,id,day,week,false));
        r.setOnClickPendingIntent(R.id.add,create(c,id,day,"evento"));
        r.setOnClickPendingIntent(R.id.addStudio,create(c,id,day,"appuntamento"));
        m.updateAppWidget(id,r); m.notifyAppWidgetViewDataChanged(id,R.id.list);
    }
}
