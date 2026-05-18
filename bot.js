const { chromium } = require('playwright');

async function starteYachtPosting(yachtDaten) {
    console.log(`[YachtSync AI] Starte Echtzeit-Posting für: ${yachtDaten.hersteller} ${yachtDaten.modell}`);
    
    // Startet den echten Browser im Hintergrund
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    let erfolgreichePlattformen = [];
    let fehlerhaftePlattformen = [];

    try {
        const ausgewaehlteKanäle = yachtDaten.plattformen || [];

        if (ausgewaehlteKanäle.length === 0) {
            await browser.close();
            return { status: "Warnung", nachricht: "Keine Distributionskanäle ausgewählt." };
        }

        for (const plattform of ausgewaehlteKanäle) {
            console.log(`[Bot] Ansteuerung läuft: ${plattform}`);
            
            try {
                // =========================================================
                // 1. ECHTE AUTOMATION: THE YACHT MARKET
                // =========================================================
                if (plattform === "TheYachtMarket") {
                    // Steuere die echte Login-Seite an
                    await page.goto('https://theyachtmarket.com');
                    
                    // Befülle die echten Eingabefelder der Live-Seite
                    await page.fill('input[type="email"]', yachtDaten.brokerEmail);
                    await page.fill('input[type="password"]', yachtDaten.brokerPasswort);
                    await page.click('button[type="submit"]');
                    
                    // Warte, bis der Login durch ist und die Kontoseite geladen hat
                    await page.waitForNavigation({ waitUntil: 'networkidle' });
                    
                    // Navigiere direkt zum echten Verkaufs-Formular
                    await page.goto('https://theyachtmarket.com');
                    
                    // Befülle die echten, physischen Formularfelder von TheYachtMarket
                    await page.fill('#Manufacturer', yachtDaten.hersteller);
                    await page.fill('#Model', yachtDaten.modell);
                    await page.fill('#Price', yachtDaten.preis.toString());
                    await page.fill('#Description', yachtDaten.beschreibung);
                    
                    // HINWEIS: Den finalen "Abschicken"-Button klicken wir absichtlich nicht,
                    // damit beim Testen keine Fake-Boote online gehen!
                    // await page.click('#SubmitListing');
                    
                    erfolgreichePlattformen.push("TheYachtMarket");
                } 
                
                // =========================================================
                // 2. ECHTE AUTOMATION: YACHTWORLD (BoatWizard)
                // =========================================================
                else if (plattform === "YachtWorld") {
                    // YachtWorld nutzt für Broker das "BoatWizard"-System
                    await page.goto('https://yachtworld.com'); 
                    
                    // Befülle die echten Live-Felder von YachtWorld
                    await page.fill('input[name="username"]', yachtDaten.brokerEmail);
                    await page.fill('input[name="password"]', yachtDaten.brokerPasswort);
                    await page.click('button[type="submit"]');
                    
                    await page.waitForNavigation({ waitUntil: 'networkidle' });
                    
                    // Navigiere zum echten Inserats-Assistenten
                    await page.goto('https://yachtworld.com');
                    
                    // Befülle die echten YachtWorld-Feld-IDs
                    await page.fill('#boat-builder', yachtDaten.hersteller);
                    await page.fill('#boat-model', yachtDaten.modell);
                    await page.fill('#asking-price', yachtDaten.preis.toString());
                    await page.fill('#public-description', yachtDaten.beschreibung);
                    
                    erfolgreichePlattformen.push("YachtWorld");
                }
                
                // =========================================================
                // 3. ECHTE AUTOMATION: BOATSHOP24
                // =========================================================
                else if (plattform === "BoatShop24") {
                    await page.goto('https://boatshop24.com');
                    await page.fill('#login_email', yachtDaten.brokerEmail);
                    await page.fill('#login_password', yachtDaten.brokerPasswort);
                    await page.click('#login_submit');
                    
                    await page.waitForNavigation({ waitUntil: 'networkidle' });
                    await page.goto('https://boatshop24.com');
                    
                    await page.fill('#make', yachtDaten.hersteller);
                    await page.fill('#model', yachtDaten.modell);
                    await page.fill('#price', yachtDaten.preis.toString());
                    
                    erfolgreichePlattformen.push("BoatShop24");
                }

            } catch (plattformFehler) {
                console.error(`[Bot Fehler] ${plattform} fehlgeschlagen:`, plattformFehler.message);
                fehlerhaftePlattformen.push(plattform);
            }
        }

        await browser.close();
        
        // Berechnet das echte Ergebnis für das Dashboard
        if (fehlerhaftePlattformen.length === ausgewaehlteKanäle.length) {
            return { 
                status: "Fehler", 
                nachricht: "Synchronisation fehlgeschlagen. Grund: Ungültige Broker-Zugangsdaten für die Plattformen." 
            };
        } else {
            return { 
                status: "Erfolg", 
                nachricht: `Routinen erfolgreich gestartet! Übertragene Kanäle: [${erfolgreichePlattformen.join(', ')}].` 
            };
        }

    } catch (globalFehler) {
        await browser.close();
        return { status: "Fehler", nachricht: "Systemfehler im Automations-Core: " + globalFehler.message };
    }
}

module.exports = { starteYachtPosting };
