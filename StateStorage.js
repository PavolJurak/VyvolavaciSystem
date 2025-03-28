class StateStorage {
        constructor(action, listok, dvere, skupina, message, report) {
        this.action = action;
        this.listok = listok;
        this.dvere = dvere;
        this.skupina = skupina;
        this.message = message;
        this.report = report;
    }

    setCall (listok = '', dvere = '', skupina = '') {
        this.action = 'call';
        this.listok = listok;
        this.dvere = dvere;
        this.skupina = skupina;
    }

    clearAction() {
        this.action = '';
        this.listok = '';
        this.dvere = '';
        this.skupina = '';
    }
}

module.exports = StateStorage;