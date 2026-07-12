/**
 * withV1Signing — habilita V1 (JAR) signing para compatibilidade com Android antigo.
 *
 * AGP 8.x removeu v1SigningEnabled/v2SigningEnabled do bloco buildTypes.
 * A API correta é enableV1Signing / enableV2Signing dentro de signingConfigs.
 *
 * Estratégia: encontra o bloco signingConfigs { } rastreando profundidade
 * corretamente, e injeta `all { enableV1Signing = true; enableV2Signing = true }`
 * antes do fechamento do bloco — aplica a TODOS os signing configs.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withV1Signing(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'build.gradle'
      );

      if (!fs.existsSync(buildGradlePath)) {
        console.warn('[withV1Signing] build.gradle não encontrado — pulando');
        return config;
      }

      let contents = fs.readFileSync(buildGradlePath, 'utf-8');

      if (contents.includes('enableV1Signing') || contents.includes('v1SigningEnabled')) {
        console.log('[withV1Signing] signing já configurado — pulando');
        return config;
      }

      const lines = contents.split('\n');
      let inSigningConfigs = false;
      let depth = 0;
      let insertAt = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const opens = (line.match(/{/g) || []).length;
        const closes = (line.match(/}/g) || []).length;

        if (!inSigningConfigs && /^\s*signingConfigs\s*\{/.test(line)) {
          inSigningConfigs = true;
          depth = opens - closes;
          continue;
        }

        if (inSigningConfigs) {
          depth += opens - closes;

          if (depth <= 0) {
            insertAt = i;
            break;
          }
        }
      }

      if (insertAt > 0) {
        const baseIndent = (lines[insertAt].match(/^(\s+)/) || ['', '        '])[1];
        const innerIndent = baseIndent + '    ';
        lines.splice(insertAt, 0,
          `${baseIndent}all {`,
          `${innerIndent}enableV1Signing = true`,
          `${innerIndent}enableV2Signing = true`,
          `${baseIndent}}`
        );
        fs.writeFileSync(buildGradlePath, lines.join('\n'));
        console.log('[withV1Signing] ✅ enableV1Signing + enableV2Signing injetados em signingConfigs.all');
      } else {
        console.warn('[withV1Signing] ⚠️ bloco signingConfigs não encontrado — v1 signing NÃO aplicado');
      }

      return config;
    },
  ]);
};
