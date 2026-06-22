package fr.openent.presences.security;

import fr.openent.presences.common.helper.WorkflowHelper;
import fr.openent.presences.enums.WorkflowActions;
import fr.wseduc.webutils.http.Binding;
import io.vertx.core.Handler;
import io.vertx.core.http.HttpServerRequest;
import org.entcore.common.http.filter.ResourcesProvider;
import org.entcore.common.user.UserInfos;

/**
 * Autorise l'accès au paramétrage des e-mails de notification :
 * <ul>
 *     <li>aux super-administrateurs (qui pilotent n'importe quel établissement), ou</li>
 *     <li>aux administrateurs locaux de la structure ciblée disposant du droit {@code MANAGE}.</li>
 * </ul>
 */
public class NotificationSettingsFilter implements ResourcesProvider {
    @Override
    public void authorize(HttpServerRequest request, Binding binding, UserInfos userInfos, Handler<Boolean> handler) {
        if (userInfos.getFunctions() != null && userInfos.getFunctions().containsKey("SUPER_ADMIN")) {
            handler.handle(true);
            return;
        }
        String structureId = request.getParam("id");
        handler.handle(userInfos.getStructures().contains(structureId)
                && WorkflowHelper.hasRight(userInfos, WorkflowActions.MANAGE.toString()));
    }
}
