package fr.openent.presences.controller;

import fr.openent.presences.core.constants.Field;
import fr.openent.presences.enums.NotificationEmailType;
import fr.openent.presences.security.NotificationSettingsFilter;
import fr.openent.presences.service.NotificationSchedulerService;
import fr.openent.presences.service.NotificationSettingsService;
import fr.openent.presences.service.impl.DefaultNotificationSettingsService;
import fr.wseduc.rs.ApiDoc;
import fr.wseduc.rs.Get;
import fr.wseduc.rs.Put;
import fr.wseduc.security.ActionType;
import fr.wseduc.security.SecuredAction;
import fr.wseduc.webutils.request.RequestUtils;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonObject;
import org.entcore.common.controller.ControllerHelper;
import org.entcore.common.http.filter.ResourceFilter;
import org.quartz.CronExpression;

/**
 * Paramétrage par établissement des e-mails de notification du module Présences
 * (activation, destinataires, périodicité). Consommé par le dashboard Vie scolaire :
 * {@code viescolaire-admin/presences/notifications}.
 */
public class NotificationSettingsController extends ControllerHelper {

    private final NotificationSettingsService settingsService = new DefaultNotificationSettingsService();
    private final NotificationSchedulerService schedulerService;

    public NotificationSettingsController(NotificationSchedulerService schedulerService) {
        this.schedulerService = schedulerService;
    }

    @Get("/structures/:id/notification-settings")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(NotificationSettingsFilter.class)
    @ApiDoc("Retrieve notification email settings for given structure")
    public void retrieve(HttpServerRequest request) {
        String structureId = request.getParam(Field.ID);
        settingsService.retrieve(structureId)
                .onSuccess(settings -> renderJson(request, new JsonObject().put("settings", settings)))
                .onFailure(err -> renderError(request));
    }

    @Put("/structures/:id/notification-settings")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(NotificationSettingsFilter.class)
    @ApiDoc("Create or update a notification email setting for given structure")
    public void put(HttpServerRequest request) {
        String structureId = request.getParam(Field.ID);
        RequestUtils.bodyToJson(request, body -> {
            String emailType = body.getString("email_type");
            if (!NotificationEmailType.isValid(emailType)) {
                badRequest(request, "invalid.email_type");
                return;
            }

            String cron = body.getString("cron");
            if (cron != null && !cron.trim().isEmpty() && !CronExpression.isValidExpression(cron)) {
                badRequest(request, "invalid.cron");
                return;
            }

            settingsService.upsert(structureId, emailType, body)
                    .onSuccess(saved -> {
                        schedulerService.reschedule(saved);
                        renderJson(request, saved);
                    })
                    .onFailure(err -> renderError(request));
        });
    }
}
