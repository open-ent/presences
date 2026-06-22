-- Paramétrage par établissement des e-mails de notification du module Présences.
-- Permet de piloter, depuis le dashboard Vie scolaire, l'activation, les destinataires
-- et la périodicité (expression cron) de chaque type d'e-mail, par structure.
CREATE TABLE presences.notification_settings (
    structure_id character varying(36) NOT NULL,
    -- DAILY_REGISTER | STATISTICS | EVENT_EXPORT | MASSMAILING
    email_type    character varying(40) NOT NULL,
    enabled       boolean NOT NULL DEFAULT false,
    -- Liste d'e-mails destinataires (tableau JSON de chaînes).
    recipients    jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- Expression cron Quartz pilotant l'envoi (types planifiés uniquement). NULL = pas de planification propre.
    cron          character varying(100),
    created       timestamp without time zone NOT NULL DEFAULT now(),
    updated       timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT notification_settings_pkey PRIMARY KEY (structure_id, email_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE presences.notification_settings TO "apps";
