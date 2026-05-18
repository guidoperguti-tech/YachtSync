const express = require('express');
const path = require('path');
const { starteYachtPosting } = require('./bot.js');

// Initialisierung von Stripe. 
// Sobald du dein Konto hast, ersetzt du 'sk_test_...' durch deinen echten Schlüssel!
const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 

const app = express();

// Erlaubt es dem Server, JSON-Daten von der Webseite zu empfangen
app.use(express.json());

// 1. ROUTE: Liefert das Dashboard (index.html) an den Browser aus
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. ROUTE: Erstellt die sichere Stripe-Bezahlschranke (Abo-Modell)
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'YachtSync Pro Monatsabo',
                        description: 'Unbegrenztes Multi-Posting auf Yacht-Marktplätzen weltweit.',
                    },
                    unit_amount: 49900, // 499,00 EUR (Wert wird in Cents angegeben)
                    recurring: { interval: 'month' }, // Automatisches, wiederkehrendes Monatsabo
                },
                quantity: 1,
            }],
            mode: 'subscription',
            // URLs, auf die der Broker nach der Stripe-Zahlung zurückgeleitet wird
            success_url: 'http://127.0.0',
            cancel_url: 'http://127.0.0',
        });

        // Schickt den sicheren Bezahl-Link zurück an die Webseite
        res.json({ id: session.id, url: session.url });
    } catch (error) {
        console.error("[Stripe Fehler]:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 3. ROUTE: Empfängt die Formulardaten und startet den Automatisierungs-Bot
app.post('/api/post-yacht', async (req, res) => {
    const yachtDaten = req.body;

    // Sicherheitsprüfung: Prüfen, ob alle wichtigen Daten vom Broker ausgefüllt wurden
    if (!yachtDaten.brokerEmail || !yachtDaten.brokerPasswort || !yachtDaten.hersteller || !yachtDaten.modell || !yachtDaten.preis) {
        return res.status(400).json({ 
            status: "Fehler", 
            nachricht: "Bitte fülle alle Pflichtfelder (Zugangsdaten, Hersteller, Modell und Preis) aus!" 
        });
    }

    try {
        // Startet die bot.js und wartet auf das Ergebnis
        const ergebnis = await starteYachtPosting(yachtDaten);
        res.json(ergebnis);
    } catch (botFehler) {
        console.error("[Server Bot-Ausführungsfehler]:", botFehler);
        res.status(500).json({ status: "Fehler", nachricht: "Der Bot konnte nicht gestartet werden." });
    }
});

// 4. SERVER-START: Nutzt den Port des Online-Hosters oder standardmäßig 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`⚓ [YachtSync Pro] SERVER ERFOLGREICH GESTARTET!`);
    console.log(`👉 Lokal einsatzbereit unter: http://127.0.0.1:${PORT}`);
    console.log(`==================================================`);
});

