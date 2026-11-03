package it.poliedrasoft.agenda;

import android.content.*;
import android.appwidget.AppWidgetManager;
import android.widget.*;
import org.json.JSONObject;
import java.util.*;

public final class AgendaService extends RemoteViewsService {
    @Override public RemoteViewsFactory onGetViewFactory(Intent intent) {
        final int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,-1);
        return new RemoteViewsFactory() {
            List<JSONObject> rows = new ArrayList<>(); boolean details;
            public void onCreate() { }
            public void onDestroy() { rows.clear(); }
            public void onDataSetChanged() {
                rows = AgendaStore.rows(AgendaService.this,AgendaStore.day(AgendaService.this,id),AgendaStore.prefs(AgendaService.this).getInt("filter"+id,0));
                details = AgendaStore.prefs(AgendaService.this).getBoolean("details"+id,false);
            }
            public int getCount() { return rows.size(); }
            public RemoteViews getViewAt(int position) {
                if (position<0 || position>=rows.size()) return null;
                JSONObject row = rows.get(position); boolean studio = "studio".equals(row.optString("source"));
                RemoteViews r = new RemoteViews(getPackageName(),R.layout.entry);
                r.setTextViewText(R.id.time,row.optString("time").isEmpty() ? "Tutto\nil giorno" : row.optString("time"));
                r.setTextViewText(R.id.entryTitle,details ? row.optString("title") : studio ? "Appuntamento studio" : "Impegno personale");
                r.setTextViewText(R.id.source,studio ? "● Studio" : "● Personale");
                r.setTextColor(R.id.source,studio ? 0xFF007E76 : 0xFF7852B5);
                // Tap opens that exact row in Personal; "Domani" proposes the personal event one day later in its editor.
                String ref = row.optString("ref"), open = ref.isEmpty() ? null : row.optString("source")+":"+ref;
                r.setOnClickFillInIntent(R.id.entryRoot,open == null ? new Intent() : new Intent().putExtra("widgetOpen",open));
                boolean postpone = open != null && !studio;
                r.setViewVisibility(R.id.postpone,postpone ? android.view.View.VISIBLE : android.view.View.GONE);
                if (postpone) {
                    r.setOnClickFillInIntent(R.id.postpone,new Intent().putExtra("widgetOpen",open).putExtra("widgetAction","rimanda"));
                    r.setContentDescription(R.id.postpone,"Rimanda a domani: "+(details ? row.optString("title") : "impegno personale")+", conferma nell’app");
                }
                return r;
            }
            public RemoteViews getLoadingView() { return null; }
            public int getViewTypeCount() { return 1; }
            public long getItemId(int position) { return position; }
            public boolean hasStableIds() { return false; }
        };
    }
}
