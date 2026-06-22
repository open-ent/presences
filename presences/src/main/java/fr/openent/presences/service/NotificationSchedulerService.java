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
        // Résout le nom + les établissements descendants (cas d'un conteneur Académie/Collèges/Lycées).
        resolveTargets(structureId).onComplete(targetsResult -> {
            JsonObject targets = targetsResult.succeeded() ? targetsResult.result() : new JsonObject();
            String name = targets.getString("name", structureId);
            // Établissements concernés : les descendants si conteneur, sinon la structure elle-même.
            JsonArray children = targets.getJsonArray("children", new JsonArray());
            boolean isGroup = !children.isEmpty();
            JsonArray targetIds = new JsonArray();
            Map<String, String> nameById = new java.util.HashMap<>();
            if (isGroup) {
                for (int i = 0; i < children.size(); i++) {
                    JsonObject c = children.getJsonObject(i);
                    targetIds.add(c.getString("id"));
                    nameById.put(c.getString("id"), c.getString("name", c.getString("id")));
                }
            } else {
                targetIds.add(structureId);
                nameById.put(structureId, name);
            }

            countRegistersByStructure(targetIds, today).onComplete(countResult -> {
                JsonObject counts = countResult.succeeded() ? countResult.result() : new JsonObject();
                int total = 0;
                for (String id : counts.fieldNames()) total += counts.getInteger(id, 0);

                String subject = "[Présences] Rapport d'ouverture des appels - " + name;
                String title = "Rapport d'ouverture des appels";
                StringBuilder body = new StringBuilder("<p>Bonjour,</p>");
                if (isGroup) {
                    body.append("<p>Récapitulatif des appels ouverts pour <strong>").append(escape(name))
                            .append("</strong> (").append(targetIds.size()).append(" établissement(s)) à la date du ")
                            .append(DateHelper.getCurrentDayWithHours()).append(".</p>")
                            .append("<p style=\"font-size:16px;\"><strong>").append(total)
                            .append("</strong> appel(s) ouvert(s) aujourd'hui au total.</p>")
                            .append("<table style=\"border-collapse:collapse;\">")
                            .append("<thead><tr><td style=\"padding:4px 12px;border-bottom:1px solid #ccc;\"><strong>Établissement</strong></td>")
                            .append("<td style=\"padding:4px 12px;border-bottom:1px solid #ccc;\"><strong>Appels ouverts</strong></td></tr></thead><tbody>");
                    // Tri par nom pour un rendu lisible.
                    java.util.List<String> ids = new java.util.ArrayList<>(nameById.keySet());
                    ids.sort((a, b) -> nameById.get(a).compareToIgnoreCase(nameById.get(b)));
                    for (String id : ids) {
                        body.append("<tr><td style=\"padding:3px 12px;\">").append(escape(nameById.get(id)))
                                .append("</td><td style=\"padding:3px 12px;\">").append(counts.getInteger(id, 0))
                                .append("</td></tr>");
                    }
                    body.append("</tbody></table>");
                } else {
                    body.append("<p>Récapitulatif des appels ouverts pour l'établissement <strong>").append(escape(name))
                            .append("</strong> à la date du ").append(DateHelper.getCurrentDayWithHours()).append(".</p>")
                            .append("<p style=\"font-size:16px;\"><strong>").append(total)
                            .append("</strong> appel(s) ouvert(s) aujourd'hui.</p>");
                }
                emailHelper.sendToAll(recipients, subject, title, body.toString());
            });
        });
    }

    /** Nom de la structure + ses établissements descendants (vide si la structure est une feuille). */
    private io.vertx.core.Future<JsonObject> resolveTargets(String structureId) {
        io.vertx.core.Promise<JsonObject> promise = io.vertx.core.Promise.promise();
        String query = "MATCH (s:Structure {id: {id}}) " +
                "OPTIONAL MATCH (s)<-[:HAS_ATTACHMENT*1..]-(d:Structure) " +
                "RETURN s.name AS name, collect(DISTINCT {id: d.id, name: d.name}) AS children;";
        neo4j.execute(query, new JsonObject().put("id", structureId), Neo4jResult.validUniqueResultHandler(event -> {
            if (event.isLeft()) {
                promise.complete(new JsonObject());
            } else {
                JsonObject row = event.right().getValue();
                // Neo4j renvoie un élément {id:null} quand il n'y a aucun descendant : on le filtre.
                JsonArray rawChildren = row.getJsonArray("children", new JsonArray());
                JsonArray children = new JsonArray();
                for (int i = 0; i < rawChildren.size(); i++) {
                    JsonObject c = rawChildren.getJsonObject(i);
                    if (c != null && c.getString("id") != null) children.add(c);
                }
                promise.complete(new JsonObject().put("name", row.getString("name")).put("children", children));
            }
        }));
        return promise.future();
    }

    /** Nombre d'appels ouverts du jour, par structure, pour un ensemble d'identifiants. */
    private io.vertx.core.Future<JsonObject> countRegistersByStructure(JsonArray structureIds, String day) {
        io.vertx.core.Promise<JsonObject> promise = io.vertx.core.Promise.promise();
        if (structureIds.isEmpty()) {
            promise.complete(new JsonObject());
            return promise.future();
        }
        String query = "SELECT structure_id, COUNT(*)::int AS count FROM " + Presences.dbSchema + ".register " +
                "WHERE structure_id IN " + Sql.listPrepared(structureIds.getList()) +
                " AND start_date::date = ?::date GROUP BY structure_id;";
        JsonArray params = new JsonArray();
        structureIds.forEach(params::add);
        params.add(day);
        sql.prepared(query, params, SqlResult.validResultHandler(event -> {
            JsonObject counts = new JsonObject();
            if (event.isRight()) {
                JsonArray rows = event.right().getValue();
                for (int i = 0; i < rows.size(); i++) {
                    JsonObject r = rows.getJsonObject(i);
                    counts.put(r.getString("structure_id"), r.getInteger("count", 0));
                }
            }
            promise.complete(counts);
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
