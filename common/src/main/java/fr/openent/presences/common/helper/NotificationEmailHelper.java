package fr.openent.presences.common.helper;

import fr.wseduc.mongodb.MongoDb;
import fr.wseduc.webutils.email.EmailSender;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.email.EmailFactory;
import org.entcore.common.neo4j.Neo4j;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Envoie les e-mails du module Présences, habillés comme les autres e-mails de l'ENT.
 *
 * <p>Chaque type d'e-mail a son gabarit dans la collection Mongo {@code email_templates}
 * ({@link #DAILY_REGISTER}, {@link #STATISTICS}, {@link #EVENT_EXPORT}, {@link #MASSMAILING}),
 * que le super-administrateur modifie dans Configuration ENT → E-mails du dashboard. Le gabarit
 * est relu à chaque envoi et fusionné sur les défauts ci-dessous, qui sont aussi ceux de
 * {@code EmailTemplateResource.defaultsFor} côté admin-dashboard : un gabarit jamais enregistré,
 * ou un Mongo injoignable, n'empêche donc aucun envoi.</p>
 *
 * <p>Le bandeau est celui de tous les e-mails de l'ENT : le logo commun (celui du thème, servi
 * par l'annuaire sous {@code /directory/massmail/logo}, cadré à 150 × 60), ou celui de
 * l'établissement concerné, souligné d'un filet à la couleur d'accent. Le contenu métier
 * (décomptes, rapport, message du publipostage) est généré par l'appelant et inséré entre
 * l'accroche et la signature.</p>
 *
 * <p>Les champs texte acceptent les jetons {@code {{etablissement}}}, {@code {{date}}} et
 * {@code {{url}}}. Pour le publipostage, l'objet et le corps viennent du modèle de courrier de
 * l'établissement : seul l'habillage est repris du gabarit.</p>
 */
public class NotificationEmailHelper {

    private static final Logger log = LoggerFactory.getLogger(NotificationEmailHelper.class);

    public static final String DAILY_REGISTER = "presences-daily-register";
    public static final String STATISTICS = "presences-statistics";
    public static final String EVENT_EXPORT = "presences-event-export";
    public static final String MASSMAILING = "presences-massmailing";

    private static final String EMAIL_TEMPLATES_COLLECTION = "email_templates";
    /** Logo commun des e-mails, celui du thème cadré par l'annuaire (cf. portal-mui, auth). */
    private static final String COMMON_EMAIL_LOGO_PATH = "/directory/massmail/logo";
    private static final Pattern STRUCTURE_ID = Pattern.compile("[0-9a-zA-Z-]+");
    private static final Pattern TOKEN = Pattern.compile("\\{\\{\\s*(\\w+)\\s*}}");
    private static final String FOOTER_NOTE = "Ce message est généré automatiquement, merci de ne pas y répondre.";

    /** Objet et corps HTML d'un e-mail prêt à partir. */
    public static class RenderedEmail {
        public final String subject;
        public final String html;

        RenderedEmail(String subject, String html) {
            this.subject = subject;
            this.html = html;
        }
    }

    private final EmailSender emailSender;
    private final String host;

    public NotificationEmailHelper(Vertx vertx, JsonObject config) {
        // EmailFactory est un singleton initialisé au démarrage de l'infra (constructeur privé).
        this.emailSender = EmailFactory.getInstance().getSender();
        this.host = config.getString("host", "");
    }

    /**
     * Valeurs par défaut d'un gabarit, tant que le document Mongo n'existe pas ou pour les champs
     * qu'il ne porte pas. Mêmes valeurs que {@code EmailTemplateResource.defaultsFor}.
     */
    static JsonObject defaultsFor(String key) {
        JsonObject d = new JsonObject()
                .put("accentColor", "#2160d8")
                .put("brandName", "ENT Scolaire")
                .put("logoUrl", "")
                .put("logoSource", "")
                .put("signature", "")
                .put("footerNote", FOOTER_NOTE);
        switch (key) {
            case DAILY_REGISTER:
                return d.put("subject", "[Présences] Rapport d'ouverture des appels - {{etablissement}}")
                        .put("title", "Rapport d'ouverture des appels")
                        .put("intro", "Bonjour,\n\nVoici le récapitulatif des appels ouverts aujourd'hui.");
            case STATISTICS:
                return d.put("subject", "[Présences] Rapport de calcul des statistiques - {{etablissement}}")
                        .put("title", "Rapport de calcul des statistiques")
                        .put("intro", "Bonjour,\n\nLe calcul des indicateurs de présence vient de se terminer.");
            case EVENT_EXPORT:
                return d.put("subject", "[Présences] Export des événements")
                        .put("title", "Export des événements")
                        .put("intro", "Bonjour,\n\nVous trouverez en pièce jointe l'export des événements demandé.");
            default:
                // MASSMAILING : objet et corps viennent du modèle de courrier de l'établissement.
                return d;
        }
    }

    /**
     * Rend l'e-mail {@code key} pour un établissement.
     *
     * @param structureId établissement concerné (logo d'établissement), ou {@code null}
     * @param tokens      valeurs des jetons ({@code etablissement}, {@code date}…) ; {@code url} est ajouté
     * @param bodyHtml    contenu métier, déjà en HTML
     */
    public Future<RenderedEmail> render(String key, String structureId, JsonObject tokens, String bodyHtml) {
        return render(host, key, structureId, tokens, bodyHtml, null, null);
    }

    /**
     * Rend un e-mail dont l'objet et le titre sont imposés par l'appelant (publipostage,
     * supervision) : le gabarit n'en fournit que l'habillage.
     *
     * @param baseUrl adresse publique de l'ENT, pour le logo
     */
    public static Future<RenderedEmail> render(String baseUrl, String key, String structureId, JsonObject tokens,
                                               String bodyHtml, String subject, String title) {
        final String base = baseUrl == null ? "" : baseUrl.replaceAll("/+$", "");
        final JsonObject values = (tokens == null ? new JsonObject() : tokens.copy());
        if (!values.containsKey("url")) values.put("url", base);
        if (!values.containsKey("date")) values.put("date", DateHelper.getCurrentDayWithHours());
        return loadTemplate(key).compose(tpl -> resolveLogo(base, tpl, structureId).map(logo -> {
            String finalSubject = subject != null ? subject : applyTokens(tpl.getString("subject", ""), values);
            String finalTitle = title != null ? title : applyTokens(tpl.getString("title", ""), values);
            String intro = applyTokens(tpl.getString("intro", ""), values);
            // L'accroche du gabarit ne vaut que pour l'e-mail qu'il décrit, pas pour un objet imposé.
            return new RenderedEmail(finalSubject, layout(tpl, logo, finalTitle,
                    subject != null ? "" : intro, bodyHtml, values));
        }));
    }

    /** Rend puis envoie le même e-mail à chaque destinataire. Journalise les échecs unitaires. */
    public Future<Void> sendToAll(String key, String structureId, JsonObject tokens, List<String> recipients,
                                  String bodyHtml) {
        return render(key, structureId, tokens, bodyHtml).compose(email -> sendToAll(email, recipients, null));
    }

    /** Envoie un e-mail déjà rendu, avec ses pièces jointes éventuelles. */
    public Future<Void> sendToAll(RenderedEmail email, List<String> recipients, JsonArray attachments) {
        if (recipients == null || recipients.isEmpty() || emailSender == null) return Future.succeededFuture();
        List<Future<Void>> futures = new ArrayList<>();
        for (String recipient : recipients) {
            Promise<Void> promise = Promise.promise();
            futures.add(promise.future());
            io.vertx.core.Handler<io.vertx.core.AsyncResult<io.vertx.core.eventbus.Message<JsonObject>>> handler = event -> {
                if (event.failed()) {
                    log.error("[Presences@NotificationEmailHelper] Échec d'envoi à " + recipient, event.cause());
                } else if ("error".equals(event.result().body().getString("status"))) {
                    log.error("[Presences@NotificationEmailHelper] Échec d'envoi à " + recipient + " : "
                            + event.result().body().getString("message", ""));
                }
                promise.complete();
            };
            if (attachments == null) {
                emailSender.sendEmail(null, recipient, null, null, email.subject, email.html, null, false, handler);
            } else {
                emailSender.sendEmail(null, recipient, null, null, email.subject, attachments, email.html, null, false, handler);
            }
        }
        return Future.join(futures).mapEmpty();
    }

    /** Gabarit {@code email_templates/<key>} fusionné sur les défauts ; les défauts seuls si Mongo ne répond pas. */
    private static Future<JsonObject> loadTemplate(String key) {
        Promise<JsonObject> promise = Promise.promise();
        JsonObject merged = defaultsFor(key);
        try {
            MongoDb.getInstance().findOne(EMAIL_TEMPLATES_COLLECTION, new JsonObject().put("_id", key), res -> {
                JsonObject stored = "ok".equals(res.body().getString("status"))
                        ? res.body().getJsonObject("result") : null;
                if (stored != null) {
                    for (String k : merged.fieldNames().toArray(new String[0])) {
                        Object v = stored.getValue(k);
                        if (v instanceof String) merged.put(k, v);
                    }
                }
                promise.complete(merged);
            });
        } catch (Exception e) {
            log.warn("[Presences@NotificationEmailHelper] Gabarit " + key + " illisible, défauts appliqués : " + e.getMessage());
            promise.tryComplete(merged);
        }
        return promise.future();
    }

    /**
     * Logo du bandeau : image spécifique, logo de l'établissement s'il en a déposé un, logo commun
     * sinon. Un {@code logoSource} vide vaut « url » si une image est renseignée, « ent » sinon.
     * Renvoie {@code {url, framed}}.
     */
    private static Future<JsonObject> resolveLogo(String base, JsonObject tpl, String structureId) {
        String source = tpl.getString("logoSource", "");
        String customLogo = tpl.getString("logoUrl", "");
        JsonObject common = new JsonObject().put("url", base + COMMON_EMAIL_LOGO_PATH).put("framed", true);
        if (!customLogo.isEmpty() && ("url".equals(source) || source.isEmpty())) {
            return Future.succeededFuture(new JsonObject().put("url", customLogo).put("framed", false));
        }
        if (!"etablissement".equals(source) || structureId == null || !STRUCTURE_ID.matcher(structureId).matches()) {
            return Future.succeededFuture(common);
        }
        Promise<JsonObject> promise = Promise.promise();
        Neo4j.getInstance().execute("MATCH (s:Structure {id: $id}) RETURN s.brandingLogo AS logo",
                new JsonObject().put("id", structureId), res -> {
                    JsonArray rows = "ok".equals(res.body().getString("status"))
                            ? res.body().getJsonArray("result") : null;
                    String logo = rows != null && !rows.isEmpty() ? rows.getJsonObject(0).getString("logo") : null;
                    promise.complete(logo == null ? common : new JsonObject()
                            .put("url", base + COMMON_EMAIL_LOGO_PATH + "?structure=" + structureId + "&v=" + logo)
                            .put("framed", true));
                });
        return promise.future();
    }

    /** Même mise en page que les autres e-mails de l'ENT (cf. auth {@code email/newDeviceAlert.html}). */
    private static String layout(JsonObject tpl, JsonObject logo, String title, String intro, String bodyHtml,
                                 JsonObject values) {
        String accent = escape(tpl.getString("accentColor", "#2160d8"));
        String brand = escape(tpl.getString("brandName", ""));
        String logoUrl = escape(logo.getString("url"));
        String img = logo.getBoolean("framed")
                ? "<img src=\"" + logoUrl + "\" alt=\"" + brand + "\" width=\"150\" height=\"60\" "
                + "style=\"display:block;border:0;width:150px;height:60px;\">"
                : "<img src=\"" + logoUrl + "\" alt=\"" + brand + "\" height=\"60\" "
                + "style=\"display:block;border:0;height:60px;max-width:300px;\">";
        String signature = applyTokens(tpl.getString("signature", ""), values);
        String footerNote = applyTokens(tpl.getString("footerNote", ""), values);
        StringBuilder html = new StringBuilder()
                .append("<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" ")
                .append("style=\"background:#f4f7fc;margin:0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;\">")
                .append("<tr><td align=\"center\">")
                .append("<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" ")
                .append("style=\"width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;")
                .append("box-shadow:0 8px 24px rgba(20,35,65,.08);\">")
                .append("<tr><td style=\"background:#ffffff;padding:24px 32px 16px;\" align=\"left\">").append(img).append("</td></tr>")
                .append("<tr><td style=\"height:4px;line-height:4px;font-size:0;background:").append(accent)
                .append(";\">&nbsp;</td></tr>")
                .append("<tr><td style=\"padding:32px;color:#15223d;font-size:15px;line-height:1.6;\">");
        if (!title.isEmpty()) {
            html.append("<h1 style=\"margin:0 0 16px;font-size:22px;color:#15223d;\">").append(escape(title)).append("</h1>");
        }
        if (!intro.isEmpty()) {
            html.append("<p style=\"margin:0 0 20px;white-space:pre-line;\">").append(escape(intro)).append("</p>");
        }
        html.append(bodyHtml == null ? "" : bodyHtml);
        if (!signature.isEmpty()) {
            html.append("<p style=\"margin:20px 0 0;color:#48526c;white-space:pre-line;\">").append(escape(signature)).append("</p>");
        }
        html.append("</td></tr>");
        if (!footerNote.isEmpty()) {
            html.append("<tr><td style=\"padding:16px 32px;border-top:1px solid #e5ebf4;color:#aab2c4;font-size:12px;")
                    .append("line-height:1.5;\">").append(escape(footerNote)).append("</td></tr>");
        }
        return html.append("</table></td></tr></table>").toString();
    }

    /** Substitue les jetons ; un jeton inconnu reste tel quel, pour qu'une faute de frappe se voie. */
    static String applyTokens(String text, JsonObject values) {
        if (text == null) return "";
        Matcher m = TOKEN.matcher(text);
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            Object v = values.getValue(m.group(1));
            m.appendReplacement(out, Matcher.quoteReplacement(v != null ? String.valueOf(v) : m.group()));
        }
        return m.appendTail(out).toString();
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
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace("\"", "&quot;");
    }
}
