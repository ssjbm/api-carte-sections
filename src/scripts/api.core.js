import './libraries/helpers';

window.CarteSections = {

	root: "https://docs.ssjb.com/",

	secrets:  null,
	sections: null,
	palettes: null,

	container: null,
	postalcode: null,
	// validmark: null,

	init: async function() {
		await Promise.all([
			documentReady(() => this.initContainer()),
			// loadJsonProperties(this, {
			// 	secrets:  `${this.root}secrets.json`,
			// 	sections: `${this.root}assets/maps/sections.json`,
			// 	palettes: `${this.root}assets/maps/palettes.json`
			// })
		]);
		if(!this.container) return;
		// console.log(this.secrets);	
		console.log(this.container);
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
			// disabled: true,
			required: true,
			title: "Entrez un code postal valide du Québec (ex: H2X 1X3)",
			pattern: "^[GgHhJj][0-9][ABCEGHJ-NPRSTV-Zabceghj-nprstv-z][ ]?[0-9][ABCEGHJ-NPRSTV-Zabceghj-nprstv-z][0-9]$"
		});
		header.create('span', 'carte-sections__header__validmark');


        this.postalcode.addEventListener('input', () => {
            let value = this.postalcode.value.replace(/\s/g, '');
            if (value.length > 3) value = value.slice(0,3) + ' ' + value.slice(3);
            this.postalcode.value = value.toUpperCase();
            if(this.postalcode.checkValidity()) {
				console.log('valid');
                this.shake();
                // this.searchSection(this.postalcode.value);
            }
        });


		tag.replaceWith(this.container);

		// console.log(this.container);
	},




    shake: async function() {
        this.postalcode.classList.add('shake');
        setTimeout(() => this.postalcode.classList.remove('shake'), 500);
    },
}



CarteSections.init();