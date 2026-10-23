package fr.openent.presences.security;

import fr.openent.presences.common.helper.WorkflowHelper;
import fr.openent.presences.enums.WorkflowActions;
import fr.wseduc.webutils.http.Binding;
import io.vertx.core.Handler;
import io.vertx.core.http.HttpServerRequest;
import org.entcore.common.http.filter.ResourcesProvider;
import org.entcore.common.user.UserInfos;

/**
 * Lecture des motifs : mêmes droits que {@link AbsenceRight}, plus le droit de gestion du module. Sans lui, un
 * gestionnaire pouvait créer un motif (route protégée par {@link Manage}) sans jamais le voir dans la liste.
 */
public class ReasonReadRight implements ResourcesProvider {
    @Override
    public void authorize(HttpServerRequest request, Binding binding, UserInfos user, Handler<Boolean> handler) {
        new AbsenceRight().authorize(request, binding, user, absenceAllowed -> handler.handle(absenceAllowed
                || WorkflowHelper.hasRight(user, WorkflowActions.MANAGE.toString())));
    }
}
