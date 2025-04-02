const irisnative = require('../intersystems-iris-native');
//const irisnative = require('../intersystems-iris-native/bin/lnxrh8arm64/irisnative.node');

const showMainPage = (req, res, config) => {
    const kk = req.params.id;
    const display = req.query.display || '';
    let css_file = 'style.css';
    if (display == 'hdtv') {
        css_file = 'style_hdtv.css';
    }

    title = config.amb[kk];
    const localData = {
        title: title,
        kk: kk,
        port: config.port,
        max: config.maxTicketsInCol,
        refreshTime: config.refreshTime,
        css_file: css_file
    };
    res.render('home', localData);
}

const getData = (req, res, config) => {
    let kk = req.params.id;

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
        res.status(500).json({status: "error", error: "Chyba pri získavaní údajov z IRIS."});
    } finally {
        if (connection) {
            try {
                connection.close();
            } catch (closeError) {
                console.error("Chyba pri zatváraní pripojenia:", closeError);
            }
        }
    }
}

const updateDisplay = (req, res, clients) => {
    let kk = req.params.id;
    clients[kk].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type: 'update'}));
        }
    });
    return res.status(200).json({status: 'success', message: 'Aktualizovanie klientov bolo spustené!'})
}

const callTicket = (req, res, status, clients, callTimeout) => {
    let kk = req.params.id;
    let listok = req.body.listok || '';
    let skupina = req.body.skupina || '';
    let dvere = req.body.dvere || '';

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
}

const setMessageText = (req, res, status, clients) => {
    let kk = req.params.id;
    let message = req.body.message || '';

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
}

const setReport = (req, res, status, callTimeout, clients) => {
    let kk = req.params.id;
    let text = req.body.report || '';

    status[kk].clearAction();
    status[kk].action = "report";
    status[kk].report = text;
    clearTimeout(callTimeout[kk]);

    clients[kk].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type:'report', text: text}));
        }
    })
    console.log('Prepnutie do oznamu!');
    return res.status(200).json({status:"success", message:'Prepnutie do oznamu bolo úspešne!'});
}

const stopCallTicket = (req, res, callTimeout, status, clients) => {
    let kk = req.params.id;

    clearTimeout(callTimeout[kk]);
    status[kk].clearAction();
    clients[kk].forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({type:'call-finish'}));
        }
    })
    console.log('Vyvolávanie pacienta bolo zrušené.');
    return res.status(200).json({status:"success", message:'Vyvolávací system je prepnutý do triaž skupiny.'});
}

module.exports = {
    showMainPage,
    getData,
    updateDisplay,
    callTicket,
    setMessageText,
    setReport,
    stopCallTicket
};