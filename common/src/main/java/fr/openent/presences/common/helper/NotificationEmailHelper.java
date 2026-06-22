package fr.openent.presences.common.helper;

import fr.wseduc.webutils.email.EmailSender;
import io.vertx.core.AsyncResult;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.eventbus.Message;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.email.EmailFactory;

import java.util.ArrayList;
import java.util.List;

/**
 * Envoie les e-mails du module Présences en les habillant d'un layout générique ENT.
 *
 * <p>Les e-mails historiques partaient en HTML brut (bandeau, structure et pied de page absents),
 * ce qui donnait des messages « hors charte ». Ici le corps métier est enveloppé dans un gabarit
 * HTML constant (en-tête coloré, contenu, pied de page) avant envoi, pour un rendu cohérent quel
 * que soit l'établissement. Le thème est volontairement générique (non décliné par département).</p>
 */
public class NotificationEmailHelper {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmailHelper.class);
    private static final String FOOTER =
            "Cet e-mail est envoyé automatiquement par l'ENT. Merci de ne pas y répondre.";

    private final EmailSender emailSender;
    private final String host;

    public NotificationEmailHelper(Vertx vertx, JsonObject config) {
        // EmailFactory est un singleton initialisé au démarrage de l'infra (constructeur privé).
        this.emailSender = EmailFactory.getInstance().getSender();
        this.host = config.getString("host", "");
    }

    /**
     * Envoie un e-mail thémé à un destinataire.
     *
     * @param recipient adresse e-mail destinataire
     * @param subject   sujet de l'e-mail
     * @param title     titre affiché dans le bandeau de l'e-mail
     * @param bodyHtml  contenu HTML métier, injecté dans le gabarit
     */
    public void send(String recipient, String subject, String title, String bodyHtml,
                     Handler<AsyncResult<Message<JsonObject>>> handler) {
        emailSender.sendEmail(null, recipient, null, null, subject, wrap(title, bodyHtml), null, false, handler);
    }

    /** Envoie le même e-mail thémé à plusieurs destinataires. Journalise les erreurs unitaires. */
    public void sendToAll(List<String> recipients, String subject, String title, String bodyHtml) {
        if (recipients == null) return;
        for (String recipient : recipients) {
            send(recipient, subject, title, bodyHtml, event -> {
                if (event.failed()) {
                    log.error("[Presences@NotificationEmailHelper] Échec d'envoi à " + recipient, event.cause());
                } else if ("error".equals(event.result().body().getString("status"))) {
                    log.error("[Presences@NotificationEmailHelper] Échec d'envoi à " + recipient + " : "
                            + event.result().body().getString("message", ""));
                }
            });
        }
    }

    /** Enveloppe le corps métier dans le layout générique ENT (avec lien vers l'hôte). */
    public String wrap(String title, String bodyHtml) {
        return buildLayout(this.host, title, bodyHtml);
    }

    /** Variante statique du layout générique ENT (sans contexte d'hôte). */
    public static String wrapBody(String title, String bodyHtml) {
        return buildLayout(null, title, bodyHtml);
    }

    private static String buildLayout(String host, String title, String bodyHtml) {
        String safeTitle = title == null ? "" : escape(title);
        String hostLink = (host == null || host.isEmpty()) ? "" :
                "<a href=\"" + host + "\" style=\"color:#2a9d8f;text-decoration:none;\">" + escape(host) + "</a>";
        return "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" " +
                "style=\"background:#f4f5f7;margin:0;padding:24px 0;\"><tr><td align=\"center\">" +
                "<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" " +
                "style=\"width:600px;max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;" +
                "box-shadow:0 1px 3px rgba(0,0,0,.08);font-family:Arial,Helvetica,sans-serif;\">" +
                "<tr><td style=\"background:#2a9d8f;padding:20px 28px;\">" +
                "<span style=\"color:#ffffff;font-size:18px;font-weight:bold;\">" + safeTitle + "</span></td></tr>" +
                "<tr><td style=\"padding:28px;color:#2d2d2d;font-size:14px;line-height:1.55;\">" +
                (bodyHtml == null ? "" : bodyHtml) + "</td></tr>" +
                "<tr><td style=\"padding:18px 28px;border-top:1px solid #ececec;color:#8a8a8a;" +
                "font-size:12px;line-height:1.5;\">" + FOOTER + "<br/>" + hostLink + "</td></tr>" +
                "</table></td></tr></table>";
    }

    /** Convertit un tableau JSON de chaînes en liste d'adresses non vides. */
    public static List<String> toRecipientList(JsonArray array) {
        List<String> list = new ArrayList<>();
        if (array == null) return list;
        for (Object o : array) {
            if (o instanceof String && !((String) o).trim().isEmpty()) list.add(((String) o).trim());
        }
        return list;
    }

    private static String escape(String value) {
        return value == null ? "" : value.replace("<", "&lt;").replace(">", "&gt;");
    }
}
