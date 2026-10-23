package fr.openent.presences.common.helper;

import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.apache.commons.lang3.StringUtils;
import org.entcore.common.neo4j.Neo4j;
import io.vertx.core.logging.LoggerFactory;
import io.vertx.core.logging.Logger;

/**
 * Choix de l'interface (AngularJS ou React) d'un module à double IHM, par ordre de priorité décroissante :
 * 1. la dérogation d'URL {@code ?ui=react|angular}, non mémorisée ; 2. la préférence de l'usager (clé {@code <module>Ui},
 * posée par « Paramètres du compte → Interfaces en cours de renouvellement ») ; 3. la configuration de la plateforme
 * ({@code frontend-ui}).
 * <p>
 * La préférence est lue à sa source, le nœud {@code UserAppConf} du graphe (celui qu'écrit
 * {@code PUT /userbook/preference/<clé>}) : ni la session ni le bus ne restituent une clé écrite pendant la session en
 * cours. Une clé ne porte ni tiret ni point (entcore les retire) : {@code statistics-presences} → {@code statisticspresencesUi}.
 */
public final class UiPreferenceHelper {
    private static final Logger log = LoggerFactory.getLogger(UiPreferenceHelper.class);

    private UiPreferenceHelper() {
    }

    /** Valeur valide d'interface (« react » ou « angular »), sinon {@code null}. */
    public static String validUi(String value) {
        return ("react".equals(value) || "angular".equals(value)) ? value : null;
    }

    /** Interface de la plateforme : « react » seulement si la configuration le demande, sinon « angular ». */
    public static String platformUi(JsonObject config) {
        return "react".equals(config.getString("frontend-ui", "angular")) ? "react" : "angular";
    }

    /**
     * Extrait le choix d'interface de la préférence rangée en CHAÎNE JSON (ex. {@code {"ui":"react","invitationShown":3}}).
     * Une préférence absente, vide, illisible ou au choix inconnu laisse la plateforme trancher.
     */
    public static String parsePreference(String raw, String platformUi) {
        if (StringUtils.isBlank(raw)) return platformUi;
        try {
            final String ui = validUi(new JsonObject(raw).getString("ui"));
            return ui != null ? ui : platformUi;
        } catch (Exception e) {
            // Préférence illisible : jamais d'erreur pour un choix d'habillage.
            log.warn("[Presences@UiPreferenceHelper] préférence illisible : " + e.getMessage());
            return platformUi;
        }
    }

    /**
     * Interface à servir à l'usager. Aucune panne de lecture ne doit empêcher le module de s'afficher : la plateforme tranche.
     *
     * @param preferenceKey clé de préférence du module (ex. {@code presencesUi})
     * @param forcedUi      dérogation d'URL {@code ?ui=} (peut être invalide ou absente)
     */
    public static Future<String> preferredUi(String userId, String preferenceKey, String forcedUi, JsonObject config) {
        final String platformUi = platformUi(config);
        final String forced = validUi(forcedUi);
        if (forced != null) return Future.succeededFuture(forced);
        if (StringUtils.isBlank(userId)) return Future.succeededFuture(platformUi);
        final Promise<String> promise = Promise.promise();
        final String query = "MATCH (:User {id:{userId}})-[:PREFERS]->(uac:UserAppConf) RETURN uac." + preferenceKey + " AS preference";
        try {
            Neo4j.getInstance().execute(query, new JsonObject().put("userId", userId), message -> {
                try {
                    final JsonArray rows = message.body().getJsonArray("result", new JsonArray());
                    promise.complete(rows.isEmpty() ? platformUi : parsePreference(rows.getJsonObject(0).getString("preference"), platformUi));
                } catch (Exception e) {
                    promise.complete(platformUi);
                }
            });
        } catch (Exception e) {
            promise.complete(platformUi);
        }
        return promise.future();
    }
}
