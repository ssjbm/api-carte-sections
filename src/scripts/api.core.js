import './libraries/helpers';

(window.CarteSections = {

	root: "https://docs.ssjb.com/",

	secrets:  null,
	sections: null,
	palettes: null,

	container: null,
	postalcode: null,
	validmark: null,

	csmap: null,
	map: null,
	toolbar: null,
	infos: null,

	layer: null,
    features: [],
    polyIndex: [],


	init: async function() {
		await Promise.all([
			documentReady(() => this.initContainer()),
			loadJsonProperties(this, {
				secrets:  `${this.root}secrets.json`,
				sections: `${this.root}assets/maps/sections.json`,
				palettes: `${this.root}assets/maps/palettes.json`
			})
		]);
		if(!this.container) return;
        loadScript('https://maps.googleapis.com/maps/api/js', {
            key:       this.secrets.MAPS_API_KEY,
            callback:  'CarteSections.initMap',
            libraries: 'geometry',
            loading:   'async',
            language:  'fr',
            region:    'CA',
            v:         'weekly',
        }, true);
	},


	initContainer: function() {
		const tag = document.querySelector('carte-sections');
		if(!tag) return;

		this.container = create('div', 'carte-sections');
		const header = this.container.create('div', 'carte-sections__header', 'Entrez votre <strong>code postal:&nbsp;&nbsp;</strong>');
		this.postalcode = header.create('input', 'carte-sections__header__postalcode', null, {
			type: 'text',
			name: 'postalcode',
			placeholder: 'H2X 1X3',
			autocomplete: 'off',
			maxLength: 7,
			disabled: true,
			required: true,
			title: "Entrez un code postal valide du Québec (ex: H2X 1X3)",
			pattern: "^[GgHhJj][0-9][ABCEGHJ-NPRSTV-Zabceghj-nprstv-z][ ]?[0-9][ABCEGHJ-NPRSTV-Zabceghj-nprstv-z][0-9]$"
		});
		this.validmark = header.create('span', 'carte-sections__header__validmark');
        this.postalcode.addEventListener('input', () => {
            let value = this.postalcode.value.replace(/\s/g, '');
            if (value.length > 3) value = value.slice(0,3) + ' ' + value.slice(3);
            this.postalcode.value = value.toUpperCase();
            if(this.postalcode.checkValidity()) {
                this.shake();
                this.searchSection(this.postalcode.value);
            }
        });

		this.csmap = this.container.create('div', 'carte-sections__map');
		this.infos = this.container.create('div', 'carte-sections__infos');

		tag.replaceWith(this.container);
	},


	initMap: async function() {
        const { ColorScheme, ControlPosition, LatLngBounds } = await google.maps.importLibrary('core');
        const { Map, Data } = await google.maps.importLibrary('maps');
		this.map = new Map(this.csmap, {
            streetViewControl: false,
            mapTypeControl: false,
            zoomControl: false,
            cameraControl: false,
            disableDoubleClickZoom: true,
			colorScheme: ColorScheme.LIGHT,
			styles: [
				{ elementType: "geometry", stylers: [{ saturation: -80 }, { gamma: 0.85 }] },
				{ elementType: "labels.text.fill", stylers: [{ saturation: -100 }, { lightness: -35 }] },
				{ elementType: "labels.text.stroke", stylers: [{ saturation: -100 }, { lightness: 70 }] },
				{ featureType: "road", elementType: "geometry", stylers: [{ saturation: -100 }, { lightness: 55 }] },
				{ featureType: "road", elementType: "geometry.stroke", stylers: [{ saturation: -100 }, { lightness: -35 }, { weight: 1.2 }] },
				{ featureType: "road.highway", elementType: "geometry", stylers: [{ saturation: -100 }, { lightness: 45 }] },
				{ featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ saturation: -100 }] },
				{ featureType: "water", elementType: "geometry", stylers: [{ saturation: -100 }, { gamma: 0.9 }] },
				{ elementType: "labels.icon", stylers: [{ visibility: "off" }] },
				{ featureType: "poi", stylers: [{ visibility: "simplified" }] },
				{ featureType: "poi.business", stylers: [{ visibility: "off" }] }
			],
        });
        this.toolbar = create('div', 'carte-sections__map__toolbar');
        this.map.controls[ControlPosition.TOP_LEFT].push(this.toolbar);

        this.layer = new Data({ map: this.map });
        this.layer.loadGeoJson(`${this.root}assets/maps/sections.geojson`, null, async (features) => {
            this.layer.addListener('click', e => this.setFocus(e.feature.getProperty('id')));
            const palette = this.getPalette(true);
            features.forEach(feature => {
                const sectionId = feature.getProperty('id');
                const color = palette[this.findSectionById(sectionId).color % palette.length];
                this.layer.overrideStyle(feature, { fillColor: color, strokeColor: color, fillOpacity: 0.20, strokeWeight: 2 });
				this.features[sectionId] = feature;
                const geoms = this.dataGeomToPolygons(feature.getGeometry());
                geoms.forEach(poly => {
                    const bounds = new LatLngBounds();
                    poly.getPaths().forEach(path => path.forEach(latlng => bounds.extend(latlng)));
                    this.polyIndex.push({ feature, poly, bounds });
                });
            });

            this.postalcode.disabled = false;
            this.zoomFeatures(features);            
            this.jumpLocation();
        });

	},


    jumpLocation: async function() {
        const geoLocation = JSON.parse(sessionStorage.getItem('geolocation'));
        if(geoLocation) {
            this.setFocus(this.findSectionByLatLng(geoLocation.coords.latitude, geoLocation.coords.longitude).id);
        } else if('geolocation' in navigator) {
            try {
                const service = await (navigator.permissions?.query({ name: 'geolocation' }));
                if(service.state !== 'denied') {
                    navigator.geolocation.getCurrentPosition(pos => {
                        sessionStorage.setItem('geolocation', JSON.stringify(pos));
                        this.setFocus(this.findSectionByLatLng(pos.coords.latitude, pos.coords.longitude).id);
                    }, null, { enableHighAccuracy: true });
                }
            } catch(e) { console.error(e); }
        }
    },


    setFocus: async function(id) {
        const section = this.findSectionById(id);
        
        this.toolbar.style.display = 'block';
        this.toolbar.textContent = `Section ${section.name}`;

        if(this.features.hasOwnProperty(id)) {
            this.zoomFeatures([this.features[id]]);
            this.layer.overrideStyle(this.features[id], { fillOpacity: 0.50 });
            if(id !== this.lastSectionId && this.features.hasOwnProperty(this.lastSectionId))
                this.layer.overrideStyle(this.features[this.lastSectionId], { fillOpacity: 0.20 });
        } else this.zoomFeatures(Object.values(this.features));

        const infos = Object.fromEntries(Object.entries(section.infos).map(([k, v]) => [k, v.join(', ')]));
        let html  = `<table class="section_results"><thead><tr><th colspan="2">Section ${section.name}</th></tr><thead><tbody>`;
            html += `<tr><td>Président :</td><td>${infos.president || '&nbsp;'}</td></tr>`;
            html += `<tr><td>Vice-président :</td><td>${infos.vice_president || '&nbsp;'}</td></tr>`;
            html += `<tr><td>Secrétaire :</td><td>${infos.secretaire || '&nbsp;'}</td></tr>`;
            html += `<tr><td>Trésorier :</td><td>${infos.tresorier || '&nbsp;'}</td></tr>`;
            html += `<tr><td>Conseiller jeunesse :</td><td>${infos.conseiller_jeunesse || '&nbsp;'}</td></tr>`;
            html += `<tr><td>Conseillers :</td><td>${infos.conseillers || '&nbsp;'}</td></tr>`;
            html += `<tr><td>Contact :</td><td><a href="mailto:${section.email}">${section.email}</a></td></tr>`;
            html += `</tbody></table>`;
        this.infos.innerHTML = html;
        this.lastSectionId = id;
    },


	dataGeomToPolygons: function(geom) {
        const out = [];
        const type = geom.getType();
        if (type === 'Polygon') out.push(new google.maps.Polygon({ paths: geom.getArray().map(ring => ring.getArray()) }));
        else if (type === 'MultiPolygon') geom.getArray().forEach(pg => out.push(new google.maps.Polygon({ paths: pg.getArray().map(ring => ring.getArray()) }))); 
        return out;
    },


    zoomFeatures: async function(features = []) {
        const bounds = new google.maps.LatLngBounds();
        features.forEach(feature => feature.getGeometry().forEachLatLng(latlng => bounds.extend(latlng)));
        if(!bounds.isEmpty()) this.map.fitBounds(bounds);
    },


    searchSection: async function(postalcode) {
        const quickSection = this.findSectionByPostalCode(postalcode);
        if(quickSection) this.setFocus(quickSection.id);
        else {
            const results = await this.getGeocode(postalcode);
            if(results.status != 'OK') {
                this.setFocus(this.sections.defaultSection.id);
                console.error(this.statusMessage(results.status));
            }
            else {
                const { lat, lng } = results.results[0].geometry.location;
                const section = this.findSectionByLatLng(lat, lng);
                this.setFocus(section.id);
            }
        }
    },


    findSectionByPostalCode: function(postalcode) {
        postalcode = postalcode.trim().replace(/^([A-Z][0-9][A-Z])\s?([0-9][A-Z][0-9][A-Z][0-9])$/i, '$1 $2').toUpperCase();
        if(this.sections.defaultSection.postalcodes.includes(postalcode)) return this.sections.defaultSection;
        let section = this.sections.sections.find(s => Array.isArray(s.postalcodes) && s.postalcodes.includes(postalcode));
        return section || null;
    },


    findSectionById: function(id) {
        const section = this.sections.sections.find(s => s.id == id);
        return section || this.sections.defaultSection || null;
    },


    findSectionByLatLng: function(lat, lng) {
        const feature = this.findContainingFeature({ lat, lng });
        if(!feature) return this.sections.defaultSection || null;
        const sectionId = feature.getProperty('id');
        return this.sections.sections.find(section => section.id == sectionId);
    },


    findContainingFeature: function(latLng) {
        for (const { feature, poly, bounds } of this.polyIndex) {
            if (!bounds.contains(latLng)) continue;
            if (google.maps.geometry.poly.containsLocation(latLng, poly)) return feature;
        }
        return null;
    },


    getGeocode: async function(postalcode, data = null) {
        const key = 'geocoder_' + postalcode.replace(/[^A-Z0-9]/, '').toLowerCase();
        if ((data = sessionStorage.getItem(key)) !== null) return JSON.parse(data);

        const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        url.searchParams.set('components', `country:CA|postal_code:${postalcode.replace(/[^A-Z0-9]/g, '')}`);
        url.searchParams.set('language', 'fr-CA');
        url.searchParams.set('key', this.secrets.MAPS_API_KEY);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if(!(data = await res.json())) throw new Error(`Bad request response format.`);
        sessionStorage.setItem(key, JSON.stringify(data));
        this.saveGeocodeRequest(key, data);

        return data;
    },


    saveGeocodeRequest: function(key, data) {
        fetch(`https://script.google.com/macros/s/${this.secrets.KV_API_KEY}/exec`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ key: key, value: JSON.stringify(data) }),
        });
    },


    statusMessage: function (status, msg) {
        switch (status) {
            case 'OVER_DAILY_LIMIT':
            case 'OVER_QUERY_LIMIT': return `Quota dépassé. Vérifiez la facturation/quota sur Google Cloud.`;
            case 'REQUEST_DENIED':   return `Requête refusée. Vérifiez les restrictions de la clé API (HTTP referrer) et l’activation de l’API Geocoding.`;
            case 'INVALID_REQUEST':  return `Requête invalide. Paramètres manquants ou mal formés.`;
            case 'UNKNOWN_ERROR':    return `Erreur inconnue côté Google. Réessayez.`;
            case 'ZERO_RESULTS':     return `Aucun résultat pour ce code postal.`;
            default: return msg || `Statut inattendu: ${status || "inconnu"}`;
        }
    },


	getPalette: function(full = false) {
        return this.palettes['light'][full ? 'full' : 'partial'];
    },


    shake: async function() {
        this.postalcode.classList.add('shake');
        setTimeout(() => this.postalcode.classList.remove('shake'), 500);
    },

}).init();