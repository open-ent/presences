package fr.openent.presences.security;

import fr.openent.presences.enums.WorkflowActionsCouple;
import fr.wseduc.webutils.http.Binding;
import io.vertx.core.Handler;
import io.vertx.core.http.HttpServerRequest;
import org.entcore.common.http.filter.ResourcesProvider;
import org.entcore.common.user.UserInfos;

public class SearchRight implements ResourcesProvider {
    @Override
    public void authorize(HttpServerRequest request, Binding binding, UserInfos user, Handler<Boolean> handler) {
        // Le super-admin plateforme n'a pas forcément les rôles calculés par structure sur un
        // établissement auquel il n'est pas rattaché ; sans ce contournement, la recherche du
        // dashboard Pilotage lui est inaccessible.
        handler.handle(user.isADMC()
                || WorkflowActionsCouple.SEARCH.hasRight(user) || WorkflowActionsCouple.SEARCH_VIESCO.hasRight(user));
    }
}