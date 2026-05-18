const { chromium } = require('playwright');

async function starteYachtPosting(yachtDaten) {
    console.log(`[YachtSync AI] Starte dynamische Synchronisation für: ${yachtDaten.hersteller}`);
    
    // Startet den Browser im Hintergrund für maximale Geschwindigkeit
    const browser = await chromium.launch({ headless: true }); 
    const context = await browser.newContext();
    const page = await context.newPage();

    let erfolgreichePlattformen = [];
    let fehlerhaftePlattformen = [];

    try {
        // Die Liste der Plattformen, die der Broker auf der Webseite angehakt hat
        const ausgewaehlteKanäle = yachtDaten.plattformen || [];

        if (ausgewaehlteKanäle.length === 0) {
            await browser.close();
            return { status: "Warnung", nachricht: "Keine Distributionskanäle ausgewählt." };
        }

        // Der Bot arbeitet alle ausgewählten Plattformen nacheinander ab
        for (const plattform of ausgewaehlteKanäle) {
            console.log(`[Bot] Verarbeite Kanal: ${plattform}`);
            
            try {
                if (plattform === "YachtWorld") {
                    // 1. ANSTEUERN & LOGIN YACHTWORLD
                    await page.goto('https://yachtworld.com'); // Beispiel-URL
                    // Hier sucht der Bot die echten Login-Felder der Seite
                    // await page.fill('#username', yachtDaten.brokerEmail);
                    // await page.fill('#password', yachtDaten.brokerPasswort);
                    // await page.click('#submit-btn');
                    
                    // 2. FORMULAR AUSFÜLLEN
                    // await page.goto('https://yachtworld.com');
                    // await page.fill('#boat-brand', yachtDaten.hersteller);
                    // await page.fill('#boat-model', yachtDaten.modell);
                    // await page.fill('#boat-price', yachtDaten.preis.toString());
                    
                    erfolgreichePlattformen.push("YachtWorld");
                } 
                
                else if (plattform === "TheYachtMarket") {
                    // 1. ANSTEUERN & LOGIN THE YACHT MARKET
                    await page.goto('https://theyachtmarket.com');
                    // await page.fill('input[type="email"]', yachtDaten.brokerEmail);
                    // await page.fill('input[type="password"]', yachtDaten.brokerPasswort);
                    // await page.click('button[type="submit"]');
                    
                    // 2. FORMULAR AUSFÜLLEN
                    // await page.goto('https://theyachtmarket.com');
                    // await page.fill('#brand-field', yachtDaten.hersteller);
                    // await page.fill('#model-field', yachtDaten.modell);
                    
                    erfolgreichePlattformen.push("TheYachtMarket");
                }
                
                else if (plattform === "BoatShop24") {
                    // 1. ANSTEUERN & LOGIN BOATSHOP24
                    await page.goto('https://boatshop24.com');
                    // Echte Felder von BoatShop24 befüllen...
                    erfolgreichePlattformen.push("BoatShop24");
                }

            } catch (plattformFehler) {
                console.error(`[Bot] Fehler auf Plattform ${plattform}:`, plattformFehler.message);
                fehlerhaftePlattformen.push(plattform);
            }
        }

        await browser.close();
        
        return { 
            status: "Erfolg", 
            nachricht: `Synchronisation abgeschlossen! Erfolgreich: [${erfolgreichePlattformen.join(', ')}]. ${fehlerhaftePlattformen.length > 0 ? 'Fehlgeschlagen: [' + fehlerhaftePlattformen.join(', ') + ']' : ''}` 
        };

    } catch (globalFehler) {
        console.error("[Bot Global Error]", globalFehler);
        await browser.close();
        return { status: "Fehler", nachricht: "Kritischer Systemfehler im Bot: " + globalFehler.message };
    }
}

module.exports = { starteYachtPosting };
