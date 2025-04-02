const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require("express-session");
const WebSocket = require('ws');

const StateStorage = require('./StateStorage');
const mainController = require('./controllers/mainController');
const loginController = require('./controllers/loginController');
const adminController = require('./controllers/adminController');

const app = express();
const port = 6400;
const isDeveloper = false;

// Nacitanie konfiguracneho suboru
var config = {};
var filePath = "";

if (isDeveloper) {
    filePath = path.join(__dirname, 'config_dev.json');
} else {
    filePath = path.join(__dirname, 'config.json');
}

try {
    config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
} catch (err) {
    console.log(`Nastala chyba pri načítaní konfiguračného súboru: ${err}`);
}

// Načítanie SSL certifikátov
var sslOptions = {};
if (isDeveloper) {
    sslOptions = {
        key: fs.readFileSync('cert_dev/server.key'),  // Súkromný kľúč
        cert: fs.readFileSync('cert_dev/server.crt')  // SSL certifikát
    };
} else {
    sslOptions = {
        key: fs.readFileSync('./cert/s-kvs01.fntn.sk.key'),  // Súkromný kľúč
        cert: fs.readFileSync('./cert/s-kvs01.fntn.sk.cer')  // SSL certifikát
    };
}

var validAmb = [];
var clients = {};
var callTimeout = {};
var status = {};

for (let item in config.amb) {
    validAmb.push(item);
    clients[item] = [];
    callTimeout[item] = null;
    status[item] = new StateStorage()
}

// Nastavenie WebSocket servera
const wss = new WebSocket.Server({ noServer: true });
wss.on('connection', function(ws, req){
    let params = new URLSearchParams(req.url.split('?')[1]);
    let amb = params.get('kk');

    if (validAmb.includes(amb)) {
        console.log('📡 Nový WebSocket klient pripojený.');
        clients[amb].push(ws);
        ws.send(JSON.stringify({
            type: 'current-status',
            data: status[amb]
        }));
    } else {
        console.log('📡 Pokus o pripojenie na WebSocket s neplatným kk parametrom!.');
    }
});

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Nastavenie session
app.use(
    session({
        secret: "TajnyKlucVyvolavanie",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: true },
    })
);

// Middleware pre autentifikaciu
function authenticatedMiddleware(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

function validAmbMiddleware(req, res, next) {
    let kk = req.params.id;
    if (!validAmb.includes((kk))) {
        return res.status(404).json({status: 'error', message: 'Neplatný kod ambulancie!'});
    }
    next();
}

function apiKeyMiddleware(req, res, next) {
    if (req.body.token != config.apiKey) {
        return res.status(404).json({status:'error', message:'Neplatný api klúč.'})
    }
    next();
}

app.get('/amb/:id/', validAmbMiddleware, (req, res) => {
    mainController.showMainPage(req, res, config);
});
app.get('/login/', loginController.showLoginPage);
app.post('/login', loginController.login);
app.post('/logout', authenticatedMiddleware, loginController.logout);

app.get('/data/:id/', validAmbMiddleware, (req, res) => {
    mainController.getData(req, res, config);
});
app.post('/update/:id/', apiKeyMiddleware, validAmbMiddleware, (req, res) =>{
    mainController.updateDisplay(req, res, clients);
});
app.post('/call/:id/', apiKeyMiddleware, validAmbMiddleware, (req, res) => {
    mainController.callTicket(req, res, status, clients, callTimeout);
});
app.post('/setmessage/:id/', apiKeyMiddleware, validAmbMiddleware, (req, res) => {
    mainController.setMessageText(req, res, status, clients);
});
app.post('/report/:id/', apiKeyMiddleware, validAmbMiddleware, (req, res) => {
    mainController.setReport(req, res, status, callTimeout, clients);
});
app.post('/stop/:id/', apiKeyMiddleware, validAmbMiddleware, (req, res) => {
    mainController.stopCallTicket(req, res, callTimeout, status, clients);
});
app.get('/admin/message', authenticatedMiddleware, (req, res) => {
    adminController.showSetTextMessagePage(req, res, status, validAmb, config);
});
app.get('/admin/ticket', authenticatedMiddleware,  (req, res) => {
    adminController.showSetCallTicketPage(req, res, validAmb, config);
});


// Spustenie HTTPS servera
const server = https.createServer(sslOptions, app).listen(config.port, () => {
    console.log(`✅ HTTPS server beží na https://localhost:${port}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
    });
});

