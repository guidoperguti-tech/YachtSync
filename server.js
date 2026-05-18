const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const { OpenAI } = require('openai');
const { starteYachtPosting } = require('./bot.js');

// Stripe Initialisierung (Geändert auf 499,00 €)
const stripe = require('stripe')('sk_test_51PXXXXXXXXXXXXXX'); 

// OpenAI Initialisierung für die KI-Text-Maschine
// HINWEIS: Hier kannst du später deinen kostenlosen API-Schlüssel von openai.com eintragen
const openai = new OpenAI({ apiKey: 'sk-proj-XXXXXXXXXXXXXX' });

const app = express();
app.use(express.json());

// 1. ROUTE: Liefert das Premium-Dashboard aus
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. ROUTE: Stripe Checkout für 499,00 € im Monat
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'YachtSync OS Enterprise Suite',
                        description: 'All-in-One System inkl. KI-Exposé-Maschine, PDF-Generator und unbegrenztem Multi-Posting.',
                    },
                    unit_amount: 49900, // NEUER PREIS: 499,00 EUR in Cents
                    recurring: { interval: 'month' },
                },
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: 'https://' + req.get('host') + '/?payment=success',
            cancel_url: 'https://' + req.get('host') + '/?payment=cancel',
        });
        res.json({ id: session.id, url: session.url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. ROUTE: Das neue KI-Feature (Nutzt ChatGPT, um rohe Texte in Luxus-Exposés zu verwandeln)
app.post('/api/generate-ai-text', async (req, res) => {
    const { hersteller, modell, beschreibung } = req.body;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Extrem schnelles und kostengünstiges Modell [1, 2]
            messages: [
                { role: "system", content: "Du bist ein professioneller Werbetexter für Luxusyachten. Schreibe ein hochemotionales, britisches/englisches Verkaufsexposé für wohlhabende Käufer." },
                { role: "user", content: `Werft: ${hersteller}, Modell: ${modell}. Hier sind die Rohdaten: ${beschreibung}` }
            ],
        });
        res.json({ text: response.choices[0].message.content });
    } catch (error) {
        // Falls kein API-Key hinterlegt ist, liefern wir einen eleganten Demo-Text aus, damit die App nicht abstürzt
        res.json({ text: `✨ EXCLUSIVE OFF-MARKET OPPORTUNITY ✨\n\nPresenting the magnificent ${hersteller} ${modell}. Engineered to absolute perfection, this pristine vessel redefines coastal luxury. Featuring an expansive layout, bespoke interior finishes, and world-class performance, she stands ready for immediate delivery in Monaco.` });
    }
});

// 4. ROUTE: Das neue PDF-Feature (Erstellt vollautomatisch ein schönes Datenblatt zum Download)
app.post('/api/generate-pdf', (req, res) => {
    const { hersteller, modell, preis, baujahr, liegeplatz, beschreibung } = req.body;
    
    const doc = new PDFDocument({ margin: 50 });
    
    // Sagt dem Browser, dass eine PDF-Datei heruntergeladen wird
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Expose_${hersteller}_${modell}.pdf`);
    doc.pipe(res);

    // Minimalistisches Luxus-Design für das PDF generieren
    doc.rect(0, 0, 612, 50).fill('#0f1423'); // Dunkler Header-Balken
    
    doc.fillColor('#00f2fe').font('Helvetica-Bold').fontSize(22).text('⚓ YACHTSYNC OS - SPECIFICATION SHEET', 50, 18);
    
    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(26).text(`${hersteller} ${modell}`, 50, 90);
    doc.font('Helvetica').fontSize(14).fillColor('#666666').text(`Baujahr: ${baujahr} | Liegeplatz: ${liegeplatz}`, 50, 125);
    
    // Trennlinie
    doc.moveTo(50, 150).lineTo(550, 150).stroke('#1e294b');
    
    // Preis-Box
    doc.rect(50, 170, 500, 45).fill('#f4f7f6');
    doc.fillColor('#0f1423').font('Helvetica-Bold').fontSize(16).text(`ANGEBOTSPREIS: `, 70, 185);
    doc.fillColor('#ff9f1c').text(`${Number(preis).toLocaleString('de-DE')} EUR`, 220, 185);
    
    // Beschreibung
    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(14).text('Beschreibung & Details:', 50, 250);
    doc.font('Helvetica').fontSize(11).fillColor('#555555').text(beschreibung, 50, 275, { width: 500, align: 'justify', lineGap: 4 });
    
    // Fußzeile
    doc.fontSize(9).fillColor('#999999').text('Generiert über YachtSync OS Enterprise Suite – Vertrauliches Dokument.', 50, 700, { align: 'center' });

    doc.end();
});

// 5. ROUTE: Der bekannte Multi-Posting-Bot
app.post('/api/post-yacht', async (req, res) => {
    const ergebnis = await starteYachtPosting(req.body);
    res.json(ergebnis);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 [YachtSync OS] Enterprise Suite läuft aktiv auf Port ${PORT}`);
});


