package fr.openent.presences.enums;

import java.util.Arrays;

/**
 * Types d'e-mails de notification du module Présences pilotables par établissement.
 * <ul>
 *     <li>{@link #DAILY_REGISTER} : rapport d'ouverture des appels (planifié, cron par structure)</li>
 *     <li>{@link #STATISTICS} : rapport de calcul des indicateurs statistiques</li>
 *     <li>{@link #EVENT_EXPORT} : export CSV des événements (déclenché manuellement)</li>
 *     <li>{@link #MASSMAILING} : notifications d'absence/retard envoyées aux responsables</li>
 * </ul>
 */
public enum NotificationEmailType {
    DAILY_REGISTER,
    STATISTICS,
    EVENT_EXPORT,
    MASSMAILING;

    public static boolean isValid(String value) {
        return value != null && Arrays.stream(values()).anyMatch(type -> type.name().equals(value));
    }

    /** Types disposant d'une planification propre (expression cron). */
    public boolean isScheduled() {
        return this == DAILY_REGISTER;
    }
}
