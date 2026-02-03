const fs = require('fs');
const fscore = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, "../");
const SRC = path.join(ROOT, 'src/');
const DIST = path.join(ROOT, 'dist/');
const BANNER = path.join(ROOT, 'scripts/banner.txt');
const TEMPLATE = path.join(ROOT, 'scripts/template.txt');
const SRCJS = path.join(SRC, 'scripts/api.core.min.js');
const SRCCSS = path.join(SRC, 'styles/api.core.min.css');
const SRCIDX = path.join(SRC, 'index.html');
const OUTJS = path.join(DIST, 'api.core.min.js');
const OUTIDX = path.join(DIST, 'index.html');

function formatFrDate(dateInput = new Date(), timeZone = 'America/Toronto') {
	const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
	const fmt = new Intl.DateTimeFormat('fr-CA', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: false,
		timeZone
	});
	const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
	const weekday = parts.weekday.charAt(0).toUpperCase() + parts.weekday.slice(1);
	return `${weekday} le ${parts.day} ${parts.month} ${parts.year} à ${parts.hour} h ${parts.minute}`;
}


// --> Load Index
const idxContent = fs.readFileSync(SRCIDX, 'utf8')
	.replace(/<script src="\/scripts\//i, '<script src="https://docs.ssjb.com/api-carte-sections/')
	.replace(/\r?\n\t<link rel="stylesheet".*?css">/mig, '');


// --> Load banner
const bannerContent = fs.readFileSync(BANNER, 'utf8')
	.replace(/###DATE###/i, formatFrDate());


// --> Load template
const templateContent = fs.readFileSync(TEMPLATE, 'utf8');


// --> Load JS
const jsContent = fs.readFileSync(SRCJS, 'utf8');


// --> Load CSS
const cssContent = fs.readFileSync(SRCCSS, 'utf8');


// --> Bundle API
const bundleContent = templateContent
    .replace(/###CSSCONTENT###/i, cssContent)
    .replace(/###JSCONTENT###/i, jsContent);


// --> Write final index
fs.writeFileSync(OUTIDX, "<!--\n\n" + bannerContent + "\n\n\-->\n" + idxContent, "utf8");


// --> Build final plugin
esbuild.build({
    stdin: { contents: bundleContent },
    banner: { js: "/*!\n\n" + bannerContent + "\n\n*/" },
    outfile: OUTJS,
    legalComments: "none",
    treeShaking: true,
    bundle: false,
    minify: true,
	supported: { "template-literal": false },
	platform: "browser",
	logLevel: "error",
    target: ["es2020"],
}).then(() => {
    console.log(`✅ Bundle final généré: ${OUTJS}`);
}).catch((err) => {
    console.error('❌ Erreur ESBuild :', err.message);
    process.exit(1);
});