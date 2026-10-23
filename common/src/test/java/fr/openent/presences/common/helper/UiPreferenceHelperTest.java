package fr.openent.presences.common.helper;

import io.vertx.core.json.JsonObject;
import io.vertx.ext.unit.TestContext;
import io.vertx.ext.unit.junit.VertxUnitRunner;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(VertxUnitRunner.class)
public class UiPreferenceHelperTest {

    @Test
    public void validUiAccepteSeulementReactEtAngular(TestContext ctx) {
        ctx.assertEquals("react", UiPreferenceHelper.validUi("react"));
        ctx.assertEquals("angular", UiPreferenceHelper.validUi("angular"));
        ctx.assertNull(UiPreferenceHelper.validUi("vue"));
        ctx.assertNull(UiPreferenceHelper.validUi(null));
    }

    @Test
    public void platformUiRepliSurAngular(TestContext ctx) {
        ctx.assertEquals("angular", UiPreferenceHelper.platformUi(new JsonObject()));
        ctx.assertEquals("angular", UiPreferenceHelper.platformUi(new JsonObject().put("frontend-ui", "inconnu")));
        ctx.assertEquals("react", UiPreferenceHelper.platformUi(new JsonObject().put("frontend-ui", "react")));
    }

    @Test
    public void parsePreferenceLitLeChoixDeLUsager(TestContext ctx) {
        // Préférence posée par les paramètres du compte : le choix prime sur la plateforme.
        ctx.assertEquals("react", UiPreferenceHelper.parsePreference("{\"ui\":\"react\",\"invitationShown\":3}", "angular"));
        ctx.assertEquals("angular", UiPreferenceHelper.parsePreference("{\"ui\":\"angular\"}", "react"));
    }

    @Test
    public void parsePreferenceLaisseLaPlateformeTrancher(TestContext ctx) {
        // « Choix de la plateforme » (ui absent ou vide), préférence absente, choix inconnu ou JSON illisible.
        ctx.assertEquals("react", UiPreferenceHelper.parsePreference("{\"invitationShown\":2}", "react"));
        ctx.assertEquals("react", UiPreferenceHelper.parsePreference("{\"ui\":\"\"}", "react"));
        ctx.assertEquals("angular", UiPreferenceHelper.parsePreference(null, "angular"));
        ctx.assertEquals("angular", UiPreferenceHelper.parsePreference("  ", "angular"));
        ctx.assertEquals("react", UiPreferenceHelper.parsePreference("{\"ui\":\"vue\"}", "react"));
        ctx.assertEquals("react", UiPreferenceHelper.parsePreference("pas du json", "react"));
    }
}
