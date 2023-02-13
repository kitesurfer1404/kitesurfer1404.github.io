function getVideoOffsetInSeconds() {
    const offset = document.getElementById('offset').value;
    var seconds = 0;
    const parts = offset.split(':');

    for(var i = 0; i < parts.length; i++) {
        const num = parseInt(parts[i]);
        const factor = Math.pow(60, parts.length - i - 1);
        seconds = seconds + (num * factor);
    }
    return seconds;
}

function parseADIF(adifText) {
    var qsos = new Array();

    var lines = adifText.split('\n');

    var qso = {};    
    for(var i = 0; i < lines.length; i++) {
        const line = lines[i];
        const startTag = line.indexOf('<', 0);
        
        if(startTag === -1) {
            continue;
        }
        
        const endTag = line.indexOf('>', startTag);
        const tagParts = line.substring(startTag + 1, endTag).split(':');
        
        if(tagParts[0].toLowerCase() === 'eoh') {
            qso = {};
            continue;
        }
        
        if(tagParts[0].toLowerCase() === 'eor') {
            //console.log(qso);
            qsos.push(qso);
            qso = {};
            continue;
        }
        
        const fieldName = tagParts[0].toLowerCase();
        const width = +tagParts[1];
        const fieldValue = line.substr(endTag + 1, width);
        
        qso[fieldName] = fieldValue;
    }
    return qsos;
}

function groupQSOsByTime(qsos) {
    const ret = qsos.reduce(function (r, a) {
        a.time_on = a.time_on.substring(0,4); // shorten to hours:minutes, discard seconds
        r[a.time_on] = r[a.time_on] || [];
        r[a.time_on].push(a);
        return r;
    }, Object.create(null));
    
    return ret;
}

function createTimestampsFromQSOs(qsosGroupedByTimeOn, targetOffset) {
    var timestamps = new Array();

    for(const [key, value] of Object.entries(qsosGroupedByTimeOn)) {
        //console.log(`${key}: ${value}`);
        const QSOhours = Math.floor(key / 100);
        const QSOminutes = parseInt(key % 100);
        const QSOStartSeconds = 60 * (QSOhours * 60 + QSOminutes);

        const QSORelativeStartSeconds = QSOStartSeconds - targetOffset;
        //console.log('QSORelativeStartSeconds: ' + QSORelativeStartSeconds);

        const timeStamp = new Date(QSORelativeStartSeconds * 1000).toISOString().substring(11, 19);
        //console.log('Timestamp: ' + timeStamp);

        var calls = new Array();
        value.forEach(function (qso, index) {
            //console.log(`i:${index} | QSO:`, qso);
            calls.push(qso['call']);
        });

        timestamps.push(timeStamp + ' ' + calls.join(', '));
    }
    return timestamps;
}

function getTimestampsFromADIF(adifText) {
    //console.log('Processing ADIF...');
    
    const videoOffset = getVideoOffsetInSeconds();
    //console.log('Offset: ' + offsetSeconds);

    var qsos = parseADIF(adifText);
    //console.log(qsos);
    
    const qsosGroupedByTime = groupQSOsByTime(qsos);

    const firstQSOkey = Object.keys(qsosGroupedByTime)[0];
    const firstQSOhours = Math.floor(firstQSOkey/100);
    const firstQSOminutes = parseInt(firstQSOkey%100);
    const firstQSOStartSeconds = 60 * (firstQSOhours*60 + firstQSOminutes);
    //console.log('Fist QSO at ' + firstQSOStartSeconds + ' seconds ');
    
    const targetOffset = firstQSOStartSeconds - videoOffset;
    
    const timestamps = createTimestampsFromQSOs(qsosGroupedByTime, targetOffset);
    return timestamps.join('\n');
}

function readFile(file) {
    //console.log('Reading file...');
    const allowedExtensions = /(\.adi|\.adif|\.ADI|\.ADIF)$/i;
    const reader = new FileReader();
  
    if(!allowedExtensions.exec(file.name)){
        alert('Please upload file having extensions .adi .adif only.');
        return false;
    }

    reader.onload = function(progressEvent) {
        const text = this.result;
        document.getElementById('adif').value = text;
        update();
    };
 
    reader.readAsText(file);
};

function dropHandler(ev) {
    //console.log('File(s) dropped');
    ev.preventDefault();
    ev.stopPropagation();

    if(ev.dataTransfer.items) {
        [...ev.dataTransfer.items].forEach((item, i) => {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                //console.log(`file[${i}].name = ${file.name}`);
                readFile(file);
            }
        });
    } else {
        [...ev.dataTransfer.files].forEach((file, i) => {
            //console.log(`file[${i}].name = ${file.name}`);
            readFile(file);
        });
    }
}

function dragOverHandler(ev) {
    console.log('File(s) in drop zone');
    ev.preventDefault();
    ev.stopPropagation();
}

function copyTimestampsToClipboard() {
    const copyText = document.getElementById('timestamps').innerText;
    navigator.clipboard.writeText(copyText);
    document.getElementById('copy').classList.add("done");  
}

function update() {
    document.getElementById('copy').classList.remove("done");
    const adifText = document.getElementById('adif').value;
    if(adifText != '') {
        const timestamps = getTimestampsFromADIF(adifText);
        document.getElementById('timestamps').innerText = timestamps;
    }
}
