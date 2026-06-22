package fr.openent.presences.common.helper;

import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.entcore.common.sql.Sql;
import org.entcore.common.sql.SqlResult;

import java.util.ArrayList;
import java.util.List;

/**
 * Lecture transverse (multi-modules) du paramétrage des e-mails de notification du module Présences,
 * stocké dans {@code presences.notification_settings}. Utilisé par massmailing / statistics-presences
 * (qui ne dépendent que de {@code common}) pour respecter les bascules définies depuis le dashboard.
 */
public class NotificationSettingsReader {

    private static final String TABLE = "presences.notification_settings";

    /**
     * Identifiant de structure « virtuel » servant à stocker les destinataires du rapport
     * <strong>consolidé</strong> (toutes structures, niveau académie), configurable par un
     * super-administrateur depuis le dashboard. Distinct de tout identifiant de structure réel.
     */
    public static final String CONSOLIDATED_STRUCTURE_ID = "ACADEMIE";

    private NotificationSettingsReader() {
    }

    /**
     * Lit la configuration d'un type d'e-mail pour un établissement.
     *
     * @return la ligne ({@code enabled}, {@code recipients}) ou {@code null} si non paramétrée.
     */
    public static Future<JsonObject> read(String structureId, String emailType) {
        Promise<JsonObject> promise = Promise.promise();
        String query = "SELECT enabled, recipients FROM " + TABLE +
                " WHERE structure_id = ? AND email_type = ?;";
        JsonArray params = new JsonArray().add(structureId).add(emailType);
        Sql.getInstance().prepared(query, params, SqlResult.validUniqueResultHandler(event -> {
            if (event.isLeft()) {
                promise.complete(null);
            } else {
                JsonObject row = event.right().getValue();
                promise.complete(row == null || row.isEmpty() ? null : row);
            }
        }));
        return promise.future();
    }

    /**
     * Collecte les destinataires des configurations <strong>activées</strong> d'un type d'e-mail.
     *
     * @param emailType    type d'e-mail
     * @param structureIds restreindre à ces établissements ({@code null} ou vide = tous)
     */
    public static Future<List<String>> collectEnabledRecipients(String emailType, List<String> structureIds) {
        Promise<List<String>> promise = Promise.promise();
        StringBuilder query = new StringBuilder("SELECT recipients FROM " + TABLE +
                " WHERE email_type = ? AND enabled = true");
        JsonArray params = new JsonArray().add(emailType);
        if (structureIds != null && !structureIds.isEmpty()) {
            query.append(" AND structure_id IN ").append(Sql.listPrepared(structureIds));
            structureIds.forEach(params::add);
        }
        query.append(";");
        Sql.getInstance().prepared(query.toString(), params, SqlResult.validResultHandler(event -> {
            List<String> recipients = new ArrayList<>();
            if (event.isRight()) {
                JsonArray rows = event.right().getValue();
                for (int i = 0; i < rows.size(); i++) {
                    parseRecipients(rows.getJsonObject(i).getValue("recipients")).forEach(r -> {
                        if (!recipients.contains(r)) recipients.add(r);
                    });
                }
            }
            promise.complete(recipients);
        }));
        return promise.future();
    }

    /**
     * Retourne les lignes <strong>activées</strong> d'un type d'e-mail : pour chaque établissement
     * paramétré, son identifiant de structure et sa liste de destinataires.
     *
     * @return liste de {@code {structure_id, recipients (List<String>)}}
     */
    public static Future<List<JsonObject>> readEnabled(String emailType) {
        Promise<List<JsonObject>> promise = Promise.promise();
        String query = "SELECT structure_id, recipients FROM " + TABLE +
                " WHERE email_type = ? AND enabled = true;";
        JsonArray params = new JsonArray().add(emailType);
        Sql.getInstance().prepared(query, params, SqlResult.validResultHandler(event -> {
            List<JsonObject> rows = new ArrayList<>();
            if (event.isRight()) {
                JsonArray result = event.right().getValue();
                for (int i = 0; i < result.size(); i++) {
                    JsonObject row = result.getJsonObject(i);
                    List<String> recipients = parseRecipients(row.getValue("recipients"));
                    if (!recipients.isEmpty()) {
                        rows.add(new JsonObject()
                                .put("structure_id", row.getString("structure_id"))
                                .put("recipients", new JsonArray(recipients)));
                    }
                }
            }
            promise.complete(rows);
        }));
        return promise.future();
    }

    /** Parse la valeur jsonb {@code recipients} (texte ou tableau) en liste d'adresses. */
    public static List<String> toRecipients(Object recipients) {
        return parseRecipients(recipients);
    }

    private static List<String> parseRecipients(Object recipients) {
        JsonArray array;
        if (recipients instanceof String) {
            try {
                array = new JsonArray((String) recipients);
            } catch (Exception e) {
                array = new JsonArray();
            }
        } else if (recipients instanceof JsonArray) {
            array = (JsonArray) recipients;
        } else {
            array = new JsonArray();
        }
        return NotificationEmailHelper.toRecipientList(array);
    }
}
