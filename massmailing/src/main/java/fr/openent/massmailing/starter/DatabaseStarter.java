package fr.openent.massmailing.starter;

import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.sql.Sql;
import org.entcore.common.sql.SqlResult;

import java.util.Arrays;

public class DatabaseStarter {
    private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseStarter.class);

    public void init(Sql sqlAdmin) {
        checkStarterState(state -> {
            if (!state) {
                checkPresencesSchema(exists -> {
                    if (exists) {
                        JsonArray statements = new JsonArray(Arrays.asList(eventStatement(), scriptStatement()));
                        sqlAdmin.transaction(statements, SqlResult.validResultHandler(event -> {
                            if (event.isLeft()) {
                                LOGGER.error("[Massmailing@DatabaseStarter] Failed to init Massmailing database", event.left().getValue());
                            } else {
                                LOGGER.info("[Massmailing@DatabaseStarter] Massmailing database successfully initialized");
                            }
                        }));
                    } else {
                        LOGGER.info("[Massmailing@DatabaseStarter] Presences schema doest not exists");
                    }
                });
            } else {
                LOGGER.info("[Massmailing@DatabaseStarter] Massmailing database already initialized");
            }
        });
    }

    private void checkPresencesSchema(Handler<Boolean> handler) {
        String query = "SELECT count(schema_name) as count FROM information_schema.schemata WHERE schema_name = 'presences';";
        Sql.getInstance().raw(query, evt -> handler.handle(hasRows(evt)));
    }

    private void checkStarterState(Handler<Boolean> handler) {
        String query = "SELECT count(filename) as count FROM massmailing.scripts WHERE filename = 'auto_massmailing_starter';";
        Sql.getInstance().raw(query, evt -> handler.handle(hasRows(evt)));
    }

    /**
     * countResult() renvoie null quand la requête échoue (mod-postgresql pas encore joignable
     * au démarrage, délai dépassé) : le déballer en long levait une NullPointerException
     * non gérée sur l'event loop. Un échec vaut « non », l'initialisation sera retentée au
     * prochain démarrage.
     */
    private static boolean hasRows(io.vertx.core.eventbus.Message<JsonObject> evt) {
        Long count = SqlResult.countResult(evt);
        return count != null && count > 0;
    }

    private JsonObject eventStatement() {
        return new JsonObject()
                .put("action", "raw")
                .put("command", "ALTER TABLE presences.event ADD COLUMN massmailed boolean NOT NULL DEFAULT FALSE;");
    }

    private JsonObject scriptStatement() {
        return new JsonObject()
                .put("action", "raw")
                .put("command", "INSERT INTO massmailing.scripts (filename) VALUES ('auto_massmailing_starter')");
    }
}
