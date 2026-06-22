package fr.openent.statistics_presences.indicator;

import fr.openent.presences.common.helper.NotificationEmailHelper;
import fr.openent.presences.common.helper.NotificationSettingsReader;
import fr.openent.presences.model.StructureStatisticsUser;
import org.entcore.common.neo4j.Neo4j;
import fr.openent.statistics_presences.StatisticsPresences;
import fr.openent.statistics_presences.bean.Report;
import fr.openent.statistics_presences.service.CommonServiceFactory;
import fr.openent.statistics_presences.service.StatisticsPresencesService;
import fr.wseduc.webutils.email.EmailSender;
import fr.wseduc.webutils.template.TemplateProcessor;
import fr.wseduc.webutils.template.lambdas.I18nLambda;
import fr.wseduc.webutils.template.lambdas.LocaleDateLambda;
import io.vertx.core.*;
import io.vertx.core.eventbus.Message;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.email.EmailFactory;
import org.entcore.common.sql.Sql;
import org.entcore.common.sql.SqlResult;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class ProcessingScheduledTask implements Handler<Long> {
    Logger log = LoggerFactory.getLogger(ProcessingScheduledTask.class);
    Vertx vertx;
    EmailSender emailSender;
    fr.openent.presences.common.helper.NotificationEmailHelper notificationEmailHelper;
    JsonObject config;
    TemplateProcessor templateProcessor;
    Long start = null;
    StatisticsPresencesService statisticsPresencesService;

    public ProcessingScheduledTask(Vertx vertx, JsonObject config, CommonServiceFactory commonServiceFactory) {
        this.vertx = vertx;
        this.config = config;
        this.emailSender = EmailFactory.getInstance().getSender();
        this.notificationEmailHelper = new fr.openent.presences.common.helper.NotificationEmailHelper(vertx, config);
        this.statisticsPresencesService = commonServiceFactory.getStatisticsPresencesService();
    }

    @Override
    public void handle(Long event) {
        start = System.currentTimeMillis();
        initTemplateProcessor();
        this.statisticsPresencesService.fetchUsers()
                .compose(this::processIndicators)
                .compose(this::dispatchReports)
                .compose(result -> this.statisticsPresencesService.clearWaitingList())
                .onComplete(ar -> {
                    if (ar.failed()) {
                        log.error(String.format("[Statistics@ProcessingScheduledTask::handle] " +
                                "Processing scheduled task failed. See previous logs. %s", ar.cause().getMessage()));
                        ar.cause().printStackTrace();
                    }
                });
    }

    private void initTemplateProcessor() {
        templateProcessor = new TemplateProcessor().escapeHTML(false);
        templateProcessor.setLambda("i18n", new I18nLambda("fr"));
        templateProcessor.setLambda("datetime", new LocaleDateLambda("fr"));
    }

    /**
     * @deprecated Replaced by {@link StatisticsPresencesService#clearWaitingList()}
     */
    @Deprecated
    private Future<Void> clearWaitingList(Void unused) {
        Promise<Void> promise = Promise.promise();
        String query = String.format("TRUNCATE TABLE %s.user;", StatisticsPresences.DB_SCHEMA);
        Sql.getInstance().raw(query, SqlResult.validUniqueResultHandler(either -> {
            if (either.isLeft()) {
                log.error(String.format("[Statistics@%s::clearWaitingList] Fail to clear waiting list %s",
                        this.getClass().getSimpleName(), either.left().getValue()));
                promise.fail(either.left().getValue());
            }
            else promise.complete();
        }));

        return promise.future();
    }

    /**
     * Fetch user list in database. The list contains all users identifier that need to be proceed;
     *
     * @return Future handling result
     * @deprecated Replaced by {@link StatisticsPresencesService#fetchUsers()}
     */
    @Deprecated
    private Future<JsonObject> fetchUsersToProcess() {
        Promise<JsonObject> promise = Promise.promise();
        String query = String.format("SELECT structure, json_agg(id) as users FROM %s.user GROUP BY structure", StatisticsPresences.DB_SCHEMA);

        Sql.getInstance().raw(query, SqlResult.validResultHandler(either -> {
            if (either.isLeft()) {
                log.error(String.format("[Statistics@ProcessingScheduledTask::fetchUsersToProcess] " +
                        "Failed to retrieve users to process. %s", either.left().getValue()));
                promise.fail(either.left().getValue());
            } else {
                JsonArray result = either.right().getValue();
                JsonObject structures = new JsonObject();
                ((List<JsonObject>) result.getList()).forEach(structure -> {
                    JsonArray users = new JsonArray(structure.getString("users"));
                    if (!users.isEmpty()) {
                        structures.put(structure.getString("structure"), users);
                    }
                });
                promise.complete(structures);
            }
        }));

        return promise.future();
    }

    /**
     * Launch indicators process. The process compute values for each user and store it in the database.
     *
     * @param structures structure map. Contains in key structure identifier and in value an array containing each structure
     *                   student to proceed
     * @return Future handling result
     * @deprecated Replaced by {@link #processIndicators(List)}
     */
    @Deprecated
    private Future<List<Report>> processIndicators(JsonObject structures) {
        Promise<List<Report>> promise = Promise.promise();
        IndicatorGeneric.process(vertx, structures)
                .onSuccess(ar -> promise.complete(Arrays.asList(ar)))
                .onFailure(fail -> {
                    log.error(String.format("[Statistics@ProcessingScheduledTask::processIndicators] " +
                            "Failed during processing of StatisticsWorker. %s", fail.getMessage()));
                    promise.fail(fail.getCause());
                });

        return promise.future();
    }

    /**
     * Launch indicators process. The process compute values for each user and store it in the database.
     *
     * @param structureStatisticsUserList user stats data grouped by structure
     * @return Future handling result
     */
    private Future<List<Report>> processIndicators(List<StructureStatisticsUser> structureStatisticsUserList) {
        Promise<List<Report>> promise = Promise.promise();
        IndicatorGeneric.process(vertx, structureStatisticsUserList)
                .onSuccess(ar -> promise.complete(Arrays.asList(ar)))
                .onFailure(fail -> {
                    log.error(String.format("[Statistics@ProcessingScheduledTask::processIndicators] " +
                            "Failed during processing of StatisticsWorker. %s", fail.getMessage()));
                    promise.fail(fail.getCause());
                });

        return promise.future();
    }

    /**
     * generate and log a report
     *
     * @param reports Reports list
     * @return Future handling result
     */
    private Future<String> generateReport(List<Report> reports) {
        Promise<String> promise = Promise.promise();
        Long end = System.currentTimeMillis();
        JsonObject params = new JsonObject()
                .put("date", start)
                .put("start", start)
                .put("end", end)
                .put("runTime", end - start)
                .put("indicators", new JsonArray(reports.stream().map(Report::toJSON).collect(Collectors.toList())));

        templateProcessor.processTemplate("indicators/report.txt", params, report -> {
            if (report == null) {
                promise.fail(new RuntimeException("[Statistics@ProcessingScheduledTask::generateReport] " +
                        "Report is null. Maybe template is not found? Please check logs."));
            } else {
                promise.complete(report);
            }
        });

        return promise.future();
    }

    /**
     * Envoie deux niveaux de rapport de calcul des statistiques :
     * <ul>
     *   <li><b>consolidé</b> (toutes structures) → destinataires globaux {@code report-recipients}
     *       (ent-core.yaml), typiquement l'académie ;</li>
     *   <li><b>par établissement</b> → pour chaque structure ayant activé le type STATISTICS dans le
     *       dashboard, un rapport limité à ses propres indicateurs, à ses destinataires.</li>
     * </ul>
     */
    @SuppressWarnings({"rawtypes", "unchecked"})
    private Future<Void> dispatchReports(List<Report> reports) {
        Promise<Void> promise = Promise.promise();
        List<Future> futures = new ArrayList<>();

        // 1. Rapport consolidé (académie) — destinataires globaux yaml + ceux configurés par un
        //    super-admin dans le dashboard (structure virtuelle CONSOLIDATED_STRUCTURE_ID).
        List<String> consolidatedFromYaml = NotificationEmailHelper
                .toRecipientList(config.getJsonArray("report-recipients", new JsonArray()));
        futures.add(Future.all(
                generateReport(reports),
                NotificationSettingsReader.read(NotificationSettingsReader.CONSOLIDATED_STRUCTURE_ID, "STATISTICS")
        ).compose(cf -> {
            String reportStr = cf.resultAt(0);
            JsonObject consolidatedRow = cf.resultAt(1);
            List<String> consolidated = new ArrayList<>(consolidatedFromYaml);
            if (consolidatedRow != null && Boolean.TRUE.equals(consolidatedRow.getBoolean("enabled"))) {
                NotificationSettingsReader.toRecipients(consolidatedRow.getValue("recipients"))
                        .forEach(r -> { if (!consolidated.contains(r)) consolidated.add(r); });
            }
            if (consolidated.isEmpty()) {
                log.info(reportStr);
                return Future.succeededFuture();
            }
            String subject = String.format("[%s] Rapport de calcul statistiques (consolidé)", config.getString("host"));
            return sendThemed(consolidated, subject, "Rapport de calcul statistiques — consolidé", reportToHtml(reportStr));
        }));

        // 2. Rapports par établissement — structures ayant activé STATISTICS dans le dashboard
        //    (en excluant la structure virtuelle du rapport consolidé).
        futures.add(NotificationSettingsReader.readEnabled("STATISTICS").compose(rows -> {
            List<Future> perStructure = new ArrayList<>();
            for (Object o : rows) {
                JsonObject row = (JsonObject) o;
                String structureId = row.getString("structure_id");
                if (NotificationSettingsReader.CONSOLIDATED_STRUCTURE_ID.equals(structureId)) continue;
                List<String> recipients = NotificationEmailHelper.toRecipientList(row.getJsonArray("recipients"));
                if (recipients.isEmpty()) continue;
                perStructure.add(structureName(structureId).compose(name -> {
                    String label = name != null ? name : structureId;
                    String subject = String.format("[%s] Rapport de calcul statistiques - %s", config.getString("host"), label);
                    return sendThemed(recipients, subject, "Rapport de calcul statistiques",
                            structureReportHtml(reports, structureId, label));
                }));
            }
            return perStructure.isEmpty() ? Future.succeededFuture() : CompositeFuture.join(perStructure).mapEmpty();
        }));

        CompositeFuture.join(futures)
                .onSuccess(res -> promise.complete())
                .onFailure(promise::fail);
        return promise.future();
    }

    /** Envoie un e-mail thémé (layout ENT) à plusieurs destinataires. */
    @SuppressWarnings({"rawtypes", "unchecked"})
    private Future<Void> sendThemed(List<String> recipients, String subject, String title, String bodyHtml) {
        Promise<Void> promise = Promise.promise();
        String themed = notificationEmailHelper.wrap(title, bodyHtml);
        List<Future> futures = new ArrayList<>();
        for (String recipient : recipients) {
            Promise<Message<JsonObject>> emailFuture = Promise.promise();
            emailFuture.future().onFailure(error -> log.error(String.format(
                    "[Statistics@%s::sendThemed] Fail to send email %s", this.getClass().getSimpleName(), error.getMessage())));
            futures.add(emailFuture.future());
            emailSender.sendEmail(null, recipient, null, null, subject, themed, null, false, emailFuture);
        }
        CompositeFuture.join(futures).onComplete(ar -> promise.complete());
        return promise.future();
    }

    /** Rapport texte (consolidé) en HTML, préformaté pour conserver la mise en forme. */
    private String reportToHtml(String report) {
        return "<pre style=\"font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap;\">"
                + report.replace("<", "&lt;").replace(">", "&gt;") + "</pre>";
    }

    /** Rapport de calcul limité à un établissement (un indicateur par ligne). */
    private String structureReportHtml(List<Report> reports, String structureId, String label) {
        StringBuilder body = new StringBuilder("<p>Rapport de calcul des indicateurs de présence pour l'établissement <strong>")
                .append(label.replace("<", "&lt;").replace(">", "&gt;")).append("</strong>.</p><ul>");
        boolean any = false;
        for (Report report : reports) {
            JsonObject summary = report.structureSummary(structureId);
            if (summary == null) continue;
            any = true;
            body.append("<li><strong>").append(summary.getString("name", "")).append("</strong> : ")
                    .append(summary.getInteger("nbStudentsProcess", 0)).append(" / ")
                    .append(summary.getInteger("nbStudents", 0)).append(" élève(s) traité(s)");
            int errors = summary.getInteger("errorCount", 0);
            if (errors > 0) body.append(" — ").append(errors).append(" erreur(s)");
            body.append("</li>");
        }
        if (!any) body.append("<li>Aucun indicateur recalculé pour cet établissement.</li>");
        body.append("</ul>");
        return body.toString();
    }

    /** Résout le nom d'un établissement (Neo4j). */
    private Future<String> structureName(String structureId) {
        Promise<String> promise = Promise.promise();
        String query = "MATCH (s:Structure {id: {id}}) RETURN s.name AS name;";
        JsonObject params = new JsonObject().put("id", structureId);
        Neo4j.getInstance().execute(query, params, org.entcore.common.neo4j.Neo4jResult.validUniqueResultHandler(event ->
                promise.complete(event.isLeft() ? null : event.right().getValue().getString("name"))));
        return promise.future();
    }
}
