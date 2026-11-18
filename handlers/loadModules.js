const fs = require("fs");
const path = require("path");

function loadModules(dir, isValid, label) {
  const modules = [];

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".js"))) {
    const mod = require(path.join(dir, file));
    if (!isValid(mod)) {
      throw new Error(`${label} inválido: ${file}`);
    }
    modules.push(mod);
  }

  return modules;
}

module.exports = { loadModules };
