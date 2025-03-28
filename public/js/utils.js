class Group {
    constructor(nazov, skupina, id, showTickets= 5) {
        this.nazov = nazov;
        this.skupina = skupina;
        this.ulElement = document.getElementById(id);
        this.pacientiList = [];
        this.maxTicketsInCol = showTickets;
    }

    add(pacient) {
        this.pacientiList.push(pacient);
    }

    sort() {
        if (this.getSize() > 0) {
            this.pacientiList.sort((a,b) => {
                if (a.poradie == b.poradie) {
                    if (a.qtn == b.qtn) {
                        return a.casN - b.casN;
                    }
                    return a.qt - b.qt;
                }
                return a.poradie - b.poradie;
            });
        }
    }

    renderGroup() {
        this.sort();
        let size = this.pacientiList.length;
        let count = 0;
        this.pacientiList.forEach(item => {
            if (count >= this.maxTicketsInCol) { return; }
            let li = document.createElement('li');
            let html= `<div></div>`
            li.innerHTML = `
                <div class='ticket'>${item.listok}</div>
                <span class='ticket-time'>Čaká od: ${item.cas}</span>
            `;
            this.ulElement.appendChild(li);
            count ++;
        });

        if (size > this.maxTicketsInCol) {
            let diff = size - count;
            let text = 'čakajúci';
            if (diff > 4) { text = 'čakajúcich'; }
            let li = document.createElement('li');
            li.innerHTML = `<div class="number-remaining-tickets ">+ ${diff} ${text} </div>`;
            this.ulElement.appendChild(li);
        }

    }

    clearGroup() {
        while(this.ulElement.firstChild) {
            this.ulElement.removeChild(this.ulElement.firstChild);
        }
        this.pacientiList = [];
    }

    getSize() {
        return this.pacientiList.length;
    }

    getNazov() {
        return this.nazov;
    }

    getSkupina() {
        return this.skupina;
    }

}

function setTime(id) {
    var today = new Date();
    var h = today.getHours();
    var m = today.getMinutes();
    var s = today.getSeconds();
    // add a zero in front of numbers<10
    m = checkTime(m);
    s = checkTime(s);
    document.getElementById(id).innerHTML = h + ":" + m + ":" + s;
}

function checkTime(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

function getTimeStampFromDate(qt) {
    var date = new Date(qt);
    return date.getTime();
}
