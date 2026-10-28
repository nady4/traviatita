const fs = require('fs');
const path = require('path');

// carpeta de estado para hosting con redeploy: los JSON viven fuera del build
// si hay un mount/volume persistente (ej. STATE_DIR=/data)
function stateDir() {
  const env = process.env.STATE_DIR;
  if (env) {
    fs.mkdirSync(env, { recursive: true });
    return env;
  }
  return __dirname;
}

// escritura atómica: primero .tmp y rename; si el proceso muere a mitad de
// write, el principal queda intacto y el .tmp conserva lo último que corrió
function create(filename, tag) {
  const FILE = path.join(stateDir(), filename);
  const TMP = `${FILE}.tmp`;

  function read(file) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`${tag} ⚠️ ${path.basename(file)} ilegible: ${err.message}`);
      }
      return null;
    }
  }

  function load(fallback) {
    return read(FILE) ?? read(TMP) ?? fallback;
  }

  function save(data) {
    fs.writeFileSync(TMP, JSON.stringify(data, null, 2));
    fs.renameSync(TMP, FILE);
  }

  return { FILE, load, save };
}

module.exports = { create };
