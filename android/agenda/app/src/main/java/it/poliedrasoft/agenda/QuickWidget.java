package it.poliedrasoft.agenda;

import android.app.PendingIntent;
import android.appwidget.*;
import android.content.*;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.json.JSONObject;

// Compact widget: next item still to come plus one-tap agenda actions. It never writes data:
// every action opens the existing Personal editor or agenda, where the user confirms.
public final class QuickWidget extends AppWidgetProvider {
    private static final Locale IT = Locale.ITALIAN;
    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) render(c, m, id); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle options) { render(c, m, id); }
    @Override public void onDeleted(Context c, int[] ids) { var edit = AgendaStore.prefs(c).edit(); for (int id : ids) edit.remove("details"+id); edit.apply(); }
    @Override public void onReceive(Context c, Intent intent) {
        super.onReceive(c, intent);
        if (!"it.poliedrasoft.agenda.QUICK".equals(intent.getAction())) return;
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
        AppWidgetManager manager = AppWidgetManager.getInstance(c);
        AppWidgetProviderInfo info = manager.getAppWidgetInfo(id);
        if (info == null || !QuickWidget.class.getName().equals(info.provider.getClassName()) || !info.provider.getPackageName().equals(c.getPackageName())) return;
        var prefs = AgendaStore.prefs(c);
        prefs.edit().putBoolean("details"+id, !prefs.getBoolean("details"+id, false)).apply();
        render(c, manager, id);
    }
    static void render(Context c, AppWidgetManager m, int id) {
        RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.quick);
        LocalDate today = LocalDate.now();
        boolean details = AgendaStore.prefs(c).getBoolean("details"+id, false);
        JSONObject next = AgendaStore.next(c, LocalDateTime.now());
        if (AgendaStore.snapshot(c) == null) {
            r.setTextViewText(R.id.nextTitle, "Apri l’app per collegare");
            r.setTextViewText(R.id.nextMeta, "Agenda non aggiornata");
            r.setOnClickPendingIntent(R.id.next, AgendaWidget.open(c, id, today, false, false));
        } else if (next == null) {
            r.setTextViewText(R.id.nextTitle, "Nessun impegno in arrivo");
            r.setTextViewText(R.id.nextMeta, "Fino al "+LocalDate.parse(AgendaStore.snapshot(c).optString("to", today.toString())).format(DateTimeFormatter.ofPattern("d MMM", IT)));
            r.setOnClickPendingIntent(R.id.next, AgendaWidget.open(c, id, today, false, false));
        } else {
            boolean studio = "studio".equals(next.optString("source"));
            LocalDate day = LocalDate.parse(next.optString("day"));
            String when = day.equals(today) ? "Oggi" : day.equals(today.plusDays(1)) ? "Domani" : day.format(DateTimeFormatter.ofPattern("EEE d MMM", IT));
            String time = next.optString("time");
            r.setTextViewText(R.id.nextTitle, details ? next.optString("title") : studio ? "Appuntamento studio" : "Impegno personale");
            r.setTextViewText(R.id.nextMeta, when+" · "+(time.isEmpty() ? "tutto il giorno" : time)+" · "+(studio ? "Studio" : "Personale"));
            r.setTextColor(R.id.nextMeta, AgendaStore.ink(AgendaStore.color(next)));
            String ref = next.optString("ref");
            Intent i = new Intent(c, MainActivity.class).setData(Uri.parse("poliedra-quick://"+id+"/open")).putExtra("day", day.toString()).putExtra("view", "giorno");
            if (!ref.isEmpty()) i.putExtra("widgetOpen", next.optString("source")+":"+ref);
            r.setOnClickPendingIntent(R.id.next, PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        r.setTextViewText(R.id.privacy, details ? "Nascondi" : "Dettagli");
        Intent toggle = new Intent(c, QuickWidget.class).setAction("it.poliedrasoft.agenda.QUICK").setData(Uri.parse("poliedra-quick://"+id+"/privacy")).putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        r.setOnClickPendingIntent(R.id.privacy, PendingIntent.getBroadcast(c, 0, toggle, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        r.setOnClickPendingIntent(R.id.add, AgendaWidget.create(c, id, today, "evento"));
        r.setOnClickPendingIntent(R.id.addStudio, AgendaWidget.create(c, id, today, "appuntamento"));
        r.setOnClickPendingIntent(R.id.today, AgendaWidget.open(c, id, today, false, false));
        r.setOnClickPendingIntent(R.id.week, AgendaWidget.open(c, id, today, true, false));
        m.updateAppWidget(id, r);
    }
}
