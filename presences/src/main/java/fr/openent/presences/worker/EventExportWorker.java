package fr.openent.presences.worker;

import fr.openent.presences.common.helper.DateHelper;
import fr.openent.presences.core.constants.Field;
import fr.openent.presences.service.ArchiveService;
import fr.openent.presences.service.CommonPresencesServiceFactory;
import fr.wseduc.webutils.I18n;
import fr.wseduc.webutils.collections.SharedDataHelper;
import fr.wseduc.webutils.email.EmailSender;
import io.vertx.core.*;
import io.vertx.core.eventbus.Message;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;
import org.entcore.common.email.EmailFactory;
import org.entcore.common.storage.Storage;
import org.entcore.common.storage.StorageFactory;
import org.vertx.java.busmods.BusModBase;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

public class EventExportWorker extends BusModBase implements Handler<Message<JsonObject>> {

    Logger log = LoggerFactory.getLogger(EventExportWorker.class);
    EmailSender emailSender;
    private fr.openent.presences.common.helper.NotificationEmailHelper notificationEmailHelper;
    private ArchiveService archiveService;
    String locale;
    String domain;
    private JsonArray exportStructures = new JsonArray();

    @Override
    public void start(final Promise<Void> startPromise) {
      try {
        super.start();
        final List<Future<?>> futures = new ArrayList<>();
        futures.add(StorageFactory.build(vertx, config));
        futures.add(SharedDataHelper.getInstance().<String, String>getMulti("server", "node"));
        Future.all(futures).compose(storageFactoryAndNode -> {
          final Storage storage = ((StorageFactory)storageFactoryAndNode.resultAt(0)).getStorage();
          final String node = ((Map<String, String>) storageFactoryAndNode.resultAt(1)).get("node");
          CommonPresencesServiceFactory commonPresencesServiceFactory = new CommonPresencesServiceFactory(vertx, storage, config, node);
          this.emailSender = EmailFactory.getInstance().getSender();
          this.notificationEmailHelper = new fr.openent.presences.common.helper.NotificationEmailHelper(vertx, config);
          this.archiveService = commonPresencesServiceFactory.archiveService();
          eb.consumer(this.getClass().getName(), this);
          return Future.succeededFuture();
        })
          .onSuccess(e -> startPromise.complete())
          .onFailure(startPromise::fail);
      } catch(Exception e) {
        startPromise.fail(e);
      }
    }

    @Override
    public void handle(Message<JsonObject> eventMessage) {
        eventMessage.reply(new JsonObject().put("status", "ok"));
        log.info("[" + this.getClass().getSimpleName() + "] receiving from route /event/archives/export");
        JsonArray structures = eventMessage.body().getJsonArray(Field.STRUCTURE, new JsonArray());
        this.exportStructures = structures;
        locale = eventMessage.body().getString(Field.LOCALE);
        domain = eventMessage.body().getString(Field.DOMAIN);

        archiveService.archiveEventsExport(structures, domain, locale)
                .compose(this::sendReport)
                .onSuccess(success -> log.info("[Presences@EventExportWorker::handle] Event export worker success" ))
                .onFailure(error -> log.error("[Presences@EventExportWorker::handle] " +
                        "Processing Event Export Worker task failed. See previous logs: " + error.getMessage(), error.getMessage()));
    }

    @SuppressWarnings("unchecked")
    private Future<Void> sendReport(JsonArray files) {
        log.info("[" + this.getClass().getSimpleName() + "] - sendReport");

        Promise<Void> promise = Promise.promise();

        JsonArray filesToSend = new JsonArray();

        ((List<JsonObject>) files.getList()).forEach(file -> {
            String base64Content = Base64.getEncoder().encodeToString(file.getString(Field.CONTENTS).getBytes(StandardCharsets.UTF_8));
            JsonObject formattedFile = new JsonObject()
                    .put(Field.NAME, file.getString(Field.NAME))
                    .put(Field.CONTENT, base64Content);
            filesToSend.add(formattedFile);
        });

        // Destinataires = liste globale (ent-core.yaml) + destinataires activés des établissements exportés (dashboard).
        List<String> structureIds = new ArrayList<>();
        for (int i = 0; i < exportStructures.size(); i++) {
            structureIds.add(exportStructures.getString(i));
        }
        List<String> baseRecipients = fr.openent.presences.common.helper.NotificationEmailHelper
                .toRecipientList(config.getJsonArray("mails-list-export", new JsonArray()));

        fr.openent.presences.common.helper.NotificationSettingsReader
                .collectEnabledRecipients("EVENT_EXPORT", structureIds)
                .onComplete(ar -> {
                    List<String> recipients = new ArrayList<>(baseRecipients);
                    if (ar.succeeded()) {
                        ar.result().forEach(r -> { if (!recipients.contains(r)) recipients.add(r); });
                    }
                    // Objet, titre et habillage : gabarit presences-event-export (dashboard). Le logo
                    // d'établissement n'a de sens que pour un export limité à un établissement.
                    String structureId = structureIds.size() == 1 ? structureIds.get(0) : null;
                    notificationEmailHelper.render(fr.openent.presences.common.helper.NotificationEmailHelper.EVENT_EXPORT,
                                    structureId, null, description())
                            .compose(email -> notificationEmailHelper.sendToAll(email, recipients, filesToSend))
                            .onSuccess(res -> promise.complete())
                            .onFailure(promise::fail);
                });

        return promise.future();
    }

    private String description() {
        return "<p style=\"margin:0;\">" + I18n.getInstance().translate("presences.csv.report.from", domain, locale) + " " +
                DateHelper.getCurrentDayWithHours() + "</p>";
    }
}
