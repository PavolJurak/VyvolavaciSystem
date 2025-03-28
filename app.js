const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require("express-session");
const WebSocket = require('ws');
//const irisnative = require('./intersystems-iris-native');
const irisnative = require('./intersystems-iris-native/bin/lnxrh8arm64/irisnative.node');
const StateStorage = require('./StateStorage');

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
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

app.get('/amb/:id/', (req, res) => {
    const kk = req.params.id;
    const display = req.query.display || '';

    let css_file = 'style.css';
    if (display == 'hdtv') { css_file = 'style_hdtv.css'; }

    if (!validAmb.includes((kk))) {
        return res.status(404).json({status: 'error', message: 'Neplatný URL parameter ambulancie!'});
    }

    title = config.amb[kk];
    const localData = {title: title, kk: kk, port: port, max: config.maxTicketsInCol, refreshTime: config.refreshTime, css_file: css_file};
    res.render('home', localData);
});

app.get('/login/', (req, res) => {
    return res.render('login', {error:""});
});

app.post('/login', (req, res) => {
    const { username, password} = req.body;
    if (username === 'admin' && password === 'urgentfntn*875') {
        req.session.user = username;
        res.redirect('/adminMessage');
    } else {
        return res.render('login', {error: "Nesprávny login alebo heslo!"})
    }
});

app.post('/logout', isAuthenticated, (req, res) => {
    req.session.destroy(() => {
       res.redirect('/login');
    });
});

app.get('/data/:id/', (req, res) => {
    let kk = req.params.id;

    if (!validAmb.includes((kk))) {
        return res.status(400).json({status: 'error', message: 'Neplatný URL parameter kk ambulancie.'});
    }

    let connection;
    try {
        connection = irisnative.createConnection({
            host: config.db.host,
            port: config.db.port,
            ns: config.db.ns,
            user: config.db.user,
            pwd: config.db.pwd
        });
        const iris = connection.createIris();
        let val = iris.classMethodValue(config.irisClass, config.irisMethod, kk);
        let data = JSON.parse(val);
        return res.send(data);
    } catch (error) {
        console.error("Chyba pri komunikácii s IRIS:", error);
        res.status(500).json({ status:"error",error: "Chyba pri získavaní údajov z IRIS."});
    } finally {
         if (connection) {
             try {
                connection.close();
             } catch (closeError) {
                console.error("Chyba pri zatváraní pripojenia:", closeError);
             }
         }
    }
});

app.post('/update/:id/', (req, res) => {
    let kk = req.params.id;

    if (req.body.token != config.apiKey) {
        return res.status(200).json({status:'error', message:'Neplatný api klúč.'})
    }
    if (!validAmb.includes((kk))) {
        return res.status(200).json({status: 'error', message: 'Neplatný kod ambulancie!'});
    }

    clients[kk].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type:'update'}));
        }
    });

    return res.status(200).json({status:'success', message:'Aktualizovanie klientov bolo spustené!'})
});

app.post('/call/:id/', (req, res) => {
    let kk = req.params.id;
    let listok = req.body.listok || '';
    let skupina = req.body.skupina || '';
    let dvere = req.body.dvere || '';

    if (req.body.token != config.apiKey) {
        return res.status(200).json({status:'error', message:'Neplatný api klúč.'})
    }

    if (!validAmb.includes((kk))) {
        return res.status(200).json({status: 'error', message: 'Neplatný parameter kk ambulancie!'});
    }

    if (status[kk].action == 'call') {
        let calledTicket = status[kk].listok;
        return res.status(200).json({ status: 'warning', message: 'Momentálne prebieha vyvolávanie iného lístka '+calledTicket+'. Opakujte voľbu neskôr.' });
    }

    if (status[kk].action == 'report') {
        return res.status(200).json({ status: 'warning', message: 'TV je prepnutá do zobrazovania oznamu! Vyvolanie neprebehlo.' });
    }

    status[kk].setCall(listok, dvere, skupina);
    clients[kk].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type:'call', listok: listok, skupina: skupina, dvere: dvere}));
        }
    });
    console.log(`Posielam klientom info o prepnutí do vyvolania lístku na oddelenie ${kk}`);

    // Casovac na ukoncenie vyvolavania pacienta
    clearTimeout(callTimeout[kk]);
    callTimeout[kk] = setTimeout(() => {
        clients[kk].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'call-finish' }));
            }
        });
        status[kk].clearAction();
        console.log(`Vyvolávanie na oddelení ${kk} skončilo.`);
    }, config.callMillisecond);

    return res.status(200).json({status:'success', message:'Spustilo sa vyvolanie!'})
});

app.post('/setmessage/:id/', (req, res) => {

    let kk = req.params.id;
    let message = req.body.message || '';

    if (req.body.token != config.apiKey) {
        return res.status(200).json({status:'error', message:'Neplatný api klúč.'})
    }

    if (!validAmb.includes((kk)) && kk != 'all') {
        return res.status(200).json({status: 'warning', message: 'Neplatný parameter kk ambulancie!'});
    }

    if (kk == 'all') {
        status[111].message = message;
        status[112].message = message;
        status[115].message = message;
        wss.clients.forEach(client => {
           if (client.readyState === WebSocket.OPEN) {
               client.send(JSON.stringify({type:'message', text: message}));
           }
        });
    } else {
        status[kk].message = message;
        clients[kk].forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
               client.send(JSON.stringify({type:'message', text: message}));
           }
        });
    }

    return res.status(200).json({status:'success', message:'Správa bola nastavená.'})
});

app.post('/report/:id/', (req, res) => {

    let kk = req.params.id;
    let text = req.body.report || '';

     if (req.body.token != config.apiKey) {
        return res.status(200).json({status:'error', message:'Neplatný api klúč.'})
    }

    if (!validAmb.includes((kk))) {
        return res.status(200).json({status: 'error', message: 'Neplatný parameter kk ambulancie!'});
    }

    status[kk].clearAction();
    status[kk].action = "report";
    status[kk].report = text;
    clearTimeout(callTimeout[kk]);

    clients[kk].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type:'report', text: text}));
        }
    })
    console.log('Prepnutie do oznamu');
    return res.status(200).json({status:"success", message:'Prepnutie do oznamu bolo úspešne.'});
});

app.post('/stop/:id/', (req, res) => {

    let kk = req.params.id;

    if (req.body.token != config.apiKey) {
        return res.status(200).json({status:'error', message:'Neplatný api klúč.'})
    }

    if (!validAmb.includes((kk))) {
        return res.status(200).json({status: 'error', message: 'Neplatný parameter kk ambulancie!'});
    }

    clearTimeout(callTimeout[kk]);
    status[kk].clearAction();
    clients[kk].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type:'call-finish'}));
        }
    })
    console.log('Vyvolávanie pacienta bolo zrušené.');
    return res.status(200).json({status:"success", message:'Vyvolávací system je prepnutý do triaž skupiny.'});
});

app.get('/adminMessage', isAuthenticated, (req, res) => {

    var select = [];
    if (validAmb.includes('111')) { select.push({value: 111, name:'111 - chirurgická klinika' }); }
    if (validAmb.includes('112')) { select.push({value: 112, name:'112 - klinika úrazov chirurgie' }); }
    if (validAmb.includes('115')) { select.push({value: 115, name:'115 - urologické oddelenie' }); }

    var data = {
        title: 'Nastavenie správy',
        section: '',
        token: config.apiKey,
        select: select,
        amb: status,
    }

    return res.render("admin/message", data)
});

app.get('/adminCallTicket', isAuthenticated,  (req, res) => {

    var select = [];
    if (validAmb.includes('111')) { select.push({value: 111, name:'111 - chirurgická klinika' }); }
    if (validAmb.includes('112')) { select.push({value: 112, name:'112 - klinika úrazov chirurgie' }); }
    if (validAmb.includes('115')) { select.push({value: 115, name:'115 - urologické oddelenie' }); }

    var data = {
        title: 'Vyvolanie lístka',
        section: '',
        body: '',
        script: '',
        message:'',
        token: config.apiKey,
        select: select,
    }
    return res.render("admin/call",data)
});

// Spustenie HTTPS servera
const server = https.createServer(sslOptions, app).listen(port, () => {
    console.log(`✅ HTTPS server beží na https://localhost:${port}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
    });
});

