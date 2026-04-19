let geoAppInitialized = false;
let map;
let markersAndLines = [];

function switchTab(tabId) {
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.app-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabId).classList.add('active');
    
    // Leaflet needs to know if its container size changed after un-hiding
    if(tabId === 'tab-globe' && map) { map.invalidateSize(); }
}

function initGeospatialApp() {
    // Prevent double initialization, but refresh map on re-open
    if (geoAppInitialized) { 
        if(map) {
            map.invalidateSize();
            // Also re-fit the bounds in case the window was resized
            const lat1 = parseFloat(document.getElementById('lat1').value);
            const lon1 = parseFloat(document.getElementById('lon1').value);
            const lat2 = parseFloat(document.getElementById('lat2').value);
            const lon2 = parseFloat(document.getElementById('lon2').value);
            if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
                map.fitBounds([[lat1, lon1], [lat2, lon2]], {padding: [50, 50]});
            }
        }
        return; 
    }
    
    // 1. Plotly Simulation (Ratio Tab)
    const N = 2500;
    const x = Array.from({length: N}, () => Math.random() * 2 - 1);
    const y = Array.from({length: N}, () => Math.random() * 2 - 1);
    
    let outCircle = 0; let inCircle = 0;
    for(let i=0; i<N; i++) { Math.sqrt(x[i]*x[i] + y[i]*y[i]) > 1 ? outCircle++ : inCircle++; }
    
    document.getElementById('val-sim-sq-circ').innerText = ((outCircle / N) * 100).toFixed(4) + '%';
    document.getElementById('val-sim-circ-sq').innerText = ((inCircle / N) * 100).toFixed(4) + '%';

    Plotly.newPlot('plotly-chart', [{
        x: x, y: y, mode: 'markers', type: 'scatter', hoverinfo: 'none',
        marker: { size: 4, color: '#3a6ea5', opacity: 0.6 }
    }], {
        margin: {t:0, b:0, l:0, r:0},
        shapes: [{
            type: 'circle', xref: 'x', yref: 'y',
            x0: -1, y0: -1, x1: 1, y1: 1,
            fillcolor: 'rgba(90, 90, 90, 0.4)', line: {color: 'rgb(5, 5, 5)'}
        }],
        xaxis: {range: [-1.1, 1.1]}, yaxis: {range: [-1.1, 1.1]}
    });

    // 2. Leaflet & Calculations (Globe Tab)
    map = L.map('map').setView([25.7801, -80.129], 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd', maxZoom: 18
    }).addTo(map);

    calculateDistances();
    
    // Bind inputs
    ['lat1', 'lon1', 'lat2', 'lon2'].forEach(id => {
        document.getElementById(id).addEventListener('input', calculateDistances);
    });

    // Allow users to click on the map to set the second coordinate dynamically
    map.on('click', function(e) {
        const lat2Input = document.getElementById('lat2');
        const lon2Input = document.getElementById('lon2');
        if (lat2Input && lon2Input) {
            lat2Input.value = e.latlng.lat.toFixed(5);
            lon2Input.value = e.latlng.lng.toFixed(5);
            calculateDistances();
        }
    });

    geoAppInitialized = true;
}

function calculateDistances() {
    const lat1 = parseFloat(document.getElementById('lat1').value);
    const lon1 = parseFloat(document.getElementById('lon1').value);
    const lat2 = parseFloat(document.getElementById('lat2').value);
    const lon2 = parseFloat(document.getElementById('lon2').value);
    
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return;

    const R_earth = (2 * 6378137.0 + 6356752.314245) / 3;
    const PI = Math.PI;

    const rLat1 = lat1 * PI / 180; const rLat2 = lat2 * PI / 180;
    const rLon1 = lon1 * PI / 180; const rLon2 = lon2 * PI / 180;
    const hav = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((rLat1-rLat2)/2), 2) + Math.cos(rLat1)*Math.cos(rLat2)*Math.pow(Math.sin((rLon1-rLon2)/2), 2))) * R_earth;
    
    const px = PI * R_earth / 180 * (lon1 - lon2) * Math.cos(((lat1 + lat2) / 2) * PI / 180);
    const py = PI * R_earth / 180 * (lat1 - lat2);
    const polar = Math.sqrt(px*px + py*py);
    
    const simple = Math.sqrt(Math.pow(lat1-lat2, 2) + Math.pow(lon1-lon2, 2)) * 105000;
    
    const dLat = (lat1 - lat2) * PI / 180; const dLon = (lon1 - lon2) * PI / 180;
    const simpleMod = Math.sqrt(Math.pow(lat1-lat2, 2) + Math.pow(lon1-lon2, 2)) * (105000 + Math.log(Math.abs(dLat/dLon || Number.EPSILON)) * 1000);

    const fmt = (num) => num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    const pct = (val, base) => (((val / base) - 1) * 100).toFixed(4) + '%';

    document.getElementById('val-haversine').innerText = fmt(hav) + ' m';
    document.getElementById('val-polar-dist').innerText = fmt(polar) + ' m';
    document.getElementById('val-polar-delta').innerText = pct(polar, hav);
    document.getElementById('val-simple-dist').innerText = fmt(simple) + ' m';
    document.getElementById('val-simple-delta').innerText = pct(simple, hav);
    document.getElementById('val-mod-dist').innerText = fmt(simpleMod) + ' m';
    document.getElementById('val-mod-delta').innerText = pct(simpleMod, hav);

    markersAndLines.forEach(layer => map.removeLayer(layer));
    markersAndLines = [];
    
    const m1 = L.marker([lat1, lon1]).addTo(map);
    const m2 = L.marker([lat2, lon2]).addTo(map);
    const line = L.polyline([[lat1, lon1], [lat2, lon2]], {color: '#4aacb8', weight: 4}).addTo(map);
    markersAndLines.push(m1, m2, line);
    map.fitBounds(line.getBounds(), {padding: [50, 50]});
}