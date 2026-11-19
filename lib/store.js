const fs = require('fs');
const path = require('path');
const config = require('../config');

const PROJECT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_DIR, 'data');

// carpeta de estado para hosting con redeploy: los JSON viven fuera del build
// si hay un mount/volume persistente (ej. STATE_DIR=/data)
function stateDir() {
  const env = config.stateDir;
  if (env) {
    fs.mkdirSync(env, { recursive: true });
    return env;
  }
  return DATA_DIR;
}

function repoDataDir() {
  return DATA_DIR;
}

function migrateLegacy(filename, dir) {
  if (dir !== DATA_DIR) return;

  for (const suffix of ['', '.tmp']) {
    const from = path.join(PROJECT_DIR, `${filename}${suffix}`);
    const to = path.join(dir, `${filename}${suffix}`);
    if (!fs.existsSync(from) || fs.existsSync(to)) continue;
    fs.renameSync(from, to);
  }
}

// escritura atómica: primero .tmp y rename; si el proceso muere a mitad de
// write, el principal queda intacto y el .tmp conserva lo último que corrió
function create(filename, tag, options = {}) {
  const dir = options.dir ?? stateDir();
  fs.mkdirSync(dir, { recursive: true });
  migrateLegacy(filename, dir);

  const FILE = path.join(dir, filename);
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

module.exports = { create, repoDataDir };
