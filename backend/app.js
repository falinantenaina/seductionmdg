const fs = require('fs');
const path = require('path');

const distApp = path.join(__dirname, 'dist', 'app.js');

if (!fs.existsSync(distApp)) {
  console.error(
    "[Passenger] backend/dist/app.js introuvable — lancez 'npm run build' (ou 'npm run build:all') dans backend/ puis redémarrez l'application.",
  );
  process.exit(1);
}

const { createApp } = require(distApp);

const app = createApp();

module.exports = app;

const port = Number(process.env.PORT) || 4000;

console.log(
  `[app.js] port=${port} ${Object.keys(process.env)
    .filter((key) => key.startsWith('PASSENGER'))
    .join(' ')}`,
);

app.listen(port, () => {
  console.log(`[app.js] serveur prêt sur le port ${port}`);
}).on('error', (error) => {
  console.error(`[app.js] listen a échoué sur le port ${port} : ${error.message}`);
});
