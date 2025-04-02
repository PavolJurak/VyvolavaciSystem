
const showSetTextMessagePage = (req ,res, status, validAmb, config) => {
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

    return res.render("admin/message", data);
}

const showSetCallTicketPage = (req, res, validAmb, config) => {
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
}

module.exports = {
    showSetTextMessagePage,
    showSetCallTicketPage
};