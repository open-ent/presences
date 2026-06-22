package fr.openent.presences.service.impl;

import fr.openent.presences.Presences;
import fr.openent.presences.db.DBService;
import fr.openent.presences.enums.NotificationEmailType;
import fr.openent.presences.service.NotificationSettingsService;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.sql.SqlResult;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class DefaultNotificationSettingsService extends DBService implements NotificationSettingsService {

    private static final Logger log = LoggerFactory.getLogger(DefaultNotificationSettingsService.class);
    private static final String TABLE = Presences.dbSchema + ".notification_settings";
    private static final String COLUMNS = "structure_id, email_type, enabled, recipients, cron";

    @Override
    public Future<JsonArray> retrieve(String structureId) {
        Promise<JsonArray> promise = Promise.promise();
        String query = "SELECT " + COLUMNS + " FROM " + TABLE + " WHERE structure_id = ?;";
        JsonArray params = new JsonArray().add(structureId);
        sql.prepared(query, params, SqlResult.validResultHandler(event -> {
            if (event.isLeft()) {
                log.error("[Presences@DefaultNotificationSettingsService::retrieve] " + event.left().getValue());
                promise.fail(event.left().getValue());
                return;
            }
            Map<String, JsonObject> byType = new HashMap<>();
            JsonArray rows = event.right().getValue();
            for (int i = 0; i < rows.size(); i++) {
                JsonObject row = normalize(rows.getJsonObject(i));
                byType.put(row.getString("email_type"), row);
            }
            JsonArray result = new JsonArray();
            // Toujours renvoyer les 4 types, avec les valeurs par défaut pour ceux non paramétrés.
            Arrays.stream(NotificationEmailType.values()).forEach(type ->
                    result.add(byType.getOrDefault(type.name(), defaultRow(structureId, type))));
            promise.complete(result);
        }));
        return promise.future();
    }

    @Override
    public Future<JsonObject> retrieveForType(String structureId, String emailType) {
        Promise<JsonObject> promise = Promise.promise();
        String query = "SELECT " + COLUMNS + " FROM " + TABLE + " WHERE structure_id = ? AND email_type = ?;";
        JsonArray params = new JsonArray().add(structureId).add(emailType);
        sql.prepared(query, params, SqlResult.validUniqueResultHandler(event -> {
            if (event.isLeft()) {
                promise.fail(event.left().getValue());
                return;
            }
            JsonObject row = event.right().getValue();
            promise.complete(row == null || row.isEmpty() ? null : normalize(row));
        }));
        return promise.future();
    }

    @Override
    public Future<JsonArray> retrieveEnabledScheduled() {
        Promise<JsonArray> promise = Promise.promise();
        String query = "SELECT " + COLUMNS + " FROM " + TABLE +
                " WHERE enabled = true AND cron IS NOT NULL AND cron <> '';";
        sql.prepared(query, new JsonArray(), SqlResult.validResultHandler(event -> {
            if (event.isLeft()) {
                promise.fail(event.left().getValue());
                return;
            }
            JsonArray rows = event.right().getValue();
            JsonArray result = new JsonArray();
            for (int i = 0; i < rows.size(); i++) {
                result.add(normalize(rows.getJsonObject(i)));
            }
            promise.complete(result);
        }));
        return promise.future();
    }

    @Override
    public Future<JsonObject> upsert(String structureId, String emailType, JsonObject body) {
        Promise<JsonObject> promise = Promise.promise();
        boolean enabled = body.getBoolean("enabled", false);
        JsonArray recipients = body.getJsonArray("recipients", new JsonArray());
        String cron = body.getString("cron", null);
        if (cron != null && cron.trim().isEmpty()) cron = null;

        String query = "INSERT INTO " + TABLE + " (structure_id, email_type, enabled, recipients, cron, updated) " +
                "VALUES (?, ?, ?, ?::jsonb, ?, now()) " +
                "ON CONFLICT (structure_id, email_type) DO UPDATE SET " +
                "enabled = EXCLUDED.enabled, recipients = EXCLUDED.recipients, cron = EXCLUDED.cron, updated = now() " +
                "RETURNING " + COLUMNS + ";";
        JsonArray params = new JsonArray()
                .add(structureId)
                .add(emailType)
                .add(enabled)
                .add(recipients.encode())
                .add(cron);
        sql.prepared(query, params, SqlResult.validUniqueResultHandler(event -> {
            if (event.isLeft()) {
                log.error("[Presences@DefaultNotificationSettingsService::upsert] " + event.left().getValue());
                promise.fail(event.left().getValue());
            } else {
                promise.complete(normalize(event.right().getValue()));
            }
        }));
        return promise.future();
    }

    /** Convertit le champ jsonb {@code recipients} (renvoyé en texte) en tableau JSON exploitable. */
    private JsonObject normalize(JsonObject row) {
        if (row == null) return null;
        Object recipients = row.getValue("recipients");
        if (recipients instanceof String) {
            try {
                row.put("recipients", new JsonArray((String) recipients));
            } catch (Exception e) {
                row.put("recipients", new JsonArray());
            }
        } else if (!(recipients instanceof JsonArray)) {
            row.put("recipients", new JsonArray());
        }
        return row;
    }

    private JsonObject defaultRow(String structureId, NotificationEmailType type) {
        return new JsonObject()
                .put("structure_id", structureId)
                .put("email_type", type.name())
                .put("enabled", false)
                .put("recipients", new JsonArray())
                .putNull("cron");
    }
}
