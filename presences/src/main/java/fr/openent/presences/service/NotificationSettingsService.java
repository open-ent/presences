package fr.openent.presences.service;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

/**
 * Gestion du paramétrage par établissement des e-mails de notification du module Présences
 * (activation, destinataires, périodicité). Cf. table {@code presences.notification_settings}.
 */
public interface NotificationSettingsService {

    /**
     * Retourne la configuration de TOUS les types d'e-mails pour un établissement.
     * Les types non encore paramétrés sont renvoyés avec leurs valeurs par défaut (désactivés).
     *
     * @param structureId identifiant de la structure
     */
    Future<JsonArray> retrieve(String structureId);

    /**
     * Retourne la configuration d'un type d'e-mail pour un établissement,
     * ou {@code null} si aucune ligne n'existe.
     */
    Future<JsonObject> retrieveForType(String structureId, String emailType);

    /**
     * Retourne toutes les configurations actives disposant d'une expression cron
     * (utilisé au démarrage pour amorcer le planificateur).
     */
    Future<JsonArray> retrieveEnabledScheduled();

    /**
     * Crée ou met à jour la configuration d'un type d'e-mail pour un établissement.
     *
     * @param structureId identifiant de la structure
     * @param emailType   type d'e-mail ({@link fr.openent.presences.enums.NotificationEmailType})
     * @param body        corps JSON : {@code enabled}, {@code recipients} (array), {@code cron}
     */
    Future<JsonObject> upsert(String structureId, String emailType, JsonObject body);
}
