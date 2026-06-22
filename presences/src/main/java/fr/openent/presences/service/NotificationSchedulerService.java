package fr.openent.presences.service;

import fr.openent.presences.Presences;
import fr.openent.presences.common.helper.DateHelper;
import fr.openent.presences.enums.NotificationEmailType;
import fr.openent.presences.common.helper.NotificationEmailHelper;
import fr.openent.presences.service.impl.DefaultNotificationSettingsService;
import fr.wseduc.cron.CronTrigger;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.neo4j.Neo4j;
import org.entcore.common.neo4j.Neo4jResult;
import org.entcore.common.sql.Sql;
import org.entcore.common.sql.SqlResult;

import java.text.ParseException;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Planifie, par établissement, l'envoi du rapport d'ouverture des appels ({@code DAILY_REGISTER}).
 * Chaque structure dispose de sa propre expression cron éditable depuis le dashboard ; à chaque
 * sauvegarde le {@link CronTrigger} correspondant est annulé puis recréé (re-planification dynamique).
 *
 * <p>Au déclenchement, on compte les appels ouverts dans la journée pour la structure et on envoie
 * le rapport thématisé (layout ENT) aux destinataires configurés.</p>
 */
public class NotificationSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(NotificationSchedulerService.class);

    private final Vertx vertx;
    private final NotificationSettingsService settingsService;
    private final NotificationEmailHelper emailHelper;
    private final Sql sql;
    private final Neo4j neo4j;
    /** Un CronTrigger par structure (type DAILY_REGISTER). */
    private final Map<String, CronTrigger> triggers = new ConcurrentHashMap<>();

    public NotificationSchedulerService(Vertx vertx, JsonObject config) {
        this.vertx = vertx;
        this.settingsService = new DefaultNotificationSettingsService();
        this.emailHelper = new NotificationEmailHelper(vertx, config);
        this.sql = Sql.getInstance();
        this.neo4j = Neo4j.getInstance();
    }

    /** Amorce le planificateur au démarrage à partir des configurations actives en base. */
    public void start() {
        settingsService.retrieveEnabledScheduled()
                .onSuccess(rows -> {
                    for (int i = 0; i < rows.size(); i++) {
                        scheduleFromRow(rows.getJsonObject(i));
                    }
                    log.info("[Presences@NotificationScheduler] " + triggers.size() + " structure(s) planifiée(s).");
                })
                .onFailure(err -> log.error("[Presences@NotificationScheduler] Amorçage impossible", err));
    }

    /**
     * (Re)planifie une structure suite à une sauvegarde depuis le dashboard.
     * Annule le trigger existant puis en recrée un si la configuration est active et cron valide.
     */
    public void reschedule(JsonObject row) {
        if (row == null) return;
        String type = row.getString("email_type");
        if (!NotificationEmailType.DAILY_REGISTER.name().equals(type)) return; // seul type planifié
        scheduleFromRow(row);
    }

    private void scheduleFromRow(JsonObject row) {
        String structureId = row.getString("structure_id");
        if (structureId == null) return;
        cancel(structureId);

        boolean enabled = row.getBoolean("enabled", false);
        String cron = row.getString("cron");
        if (!enabled || cron == null || cron.trim().isEmpty()) return;

        try {
            CronTrigger trigger = new CronTrigger(vertx, cron);
            trigger.schedule(id -> fireDailyRegister(structureId));
            triggers.put(structureId, trigger);
        } catch (ParseException e) {
            log.error("[Presences@NotificationScheduler] Expression cron invalide pour " + structureId + " : " + cron, e);
        }
    }

    private void cancel(String structureId) {
        CronTrigger trigger = triggers.remove(structureId);
        if (trigger != null) {
            trigger.cancel();
        }
    }

    /** Construit et envoie le rapport quotidien d'ouverture des appels pour une structure. */
    private void fireDailyRegister(String structureId) {
        settingsService.retrieveForType(structureId, NotificationEmailType.DAILY_REGISTER.name())
                .onSuccess(setting -> {
                    if (setting == null || !setting.getBoolean("enabled", false)) return;
                    java.util.List<String> recipients =
                            NotificationEmailHelper.toRecipientList(setting.getJsonArray("recipients"));
                    if (recipients.isEmpty()) return;
                    buildAndSend(structureId, recipients);
                })
                .onFailure(err -> log.error("[Presences@NotificationScheduler] Lecture config échouée pour " + structureId, err));
    }

    private void buildAndSend(String structureId, java.util.List<String> recipients) {
        String today = DateHelper.getCurrentDay();
        countRegisters(structureId, today).onComplete(countResult -> {
            int count = countResult.succeeded() ? countResult.result() : 0;
            structureName(structureId).onComplete(nameResult -> {
                String name = nameResult.succeeded() && nameResult.result() != null ? nameResult.result() : structureId;
                String subject = "[Présences] Rapport d'ouverture des appels - " + name;
                String title = "Rapport d'ouverture des appels";
                String body = "<p>Bonjour,</p>" +
                        "<p>Voici le récapitulatif des appels ouverts pour l'établissement " +
                        "<strong>" + escape(name) + "</strong> à la date du " +
                        DateHelper.getCurrentDayWithHours() + ".</p>" +
                        "<p style=\"font-size:16px;\"><strong>" + count + "</strong> appel(s) ouvert(s) aujourd'hui.</p>";
                emailHelper.sendToAll(recipients, subject, title, body);
            });
        });
    }

    private io.vertx.core.Future<Integer> countRegisters(String structureId, String day) {
        io.vertx.core.Promise<Integer> promise = io.vertx.core.Promise.promise();
        String query = "SELECT COUNT(*)::int AS count FROM " + Presences.dbSchema + ".register " +
                "WHERE structure_id = ? AND start_date::date = ?::date;";
        JsonArray params = new JsonArray().add(structureId).add(day);
        sql.prepared(query, params, SqlResult.validUniqueResultHandler(event -> {
            if (event.isLeft()) {
                promise.complete(0);
            } else {
                promise.complete(event.right().getValue().getInteger("count", 0));
            }
        }));
        return promise.future();
    }

    private io.vertx.core.Future<String> structureName(String structureId) {
        io.vertx.core.Promise<String> promise = io.vertx.core.Promise.promise();
        String query = "MATCH (s:Structure {id: {id}}) RETURN s.name AS name;";
        JsonObject params = new JsonObject().put("id", structureId);
        neo4j.execute(query, params, Neo4jResult.validUniqueResultHandler(event -> {
            if (event.isLeft()) {
                promise.complete(null);
            } else {
                promise.complete(event.right().getValue().getString("name"));
            }
        }));
        return promise.future();
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("<", "&lt;").replace(">", "&gt;");
    }

    public Map<String, CronTrigger> getTriggers() {
        return Collections.unmodifiableMap(triggers);
    }
}
