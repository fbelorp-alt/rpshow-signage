/**
 * withV1Signing — adiciona v1SigningEnabled true ao release signing config do build.gradle
 * Necessário para dispositivos com Android antigo (T10Plus, etc.) que rejeitam APK só com v2.
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

      if (contents.includes('v1SigningEnabled')) {
        console.log('[withV1Signing] v1SigningEnabled já presente — pulando');
        return config;
      }

      // Percorre linha a linha e insere v1SigningEnabled após a última propriedade
      // do bloco "release" dentro de "signingConfigs"
      const lines = contents.split('\n');
      let inSigningConfigs = false;
      let inReleaseBlock = false;
      let depth = 0;
      let insertAt = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!inSigningConfigs && trimmed.startsWith('signingConfigs')) {
          inSigningConfigs = true;
        }

        if (inSigningConfigs && !inReleaseBlock && /\brelease\s*\{/.test(trimmed)) {
          inReleaseBlock = true;
          depth = 0;
        }

        if (inReleaseBlock) {
          depth += (line.match(/{/g) || []).length;
          depth -= (line.match(/}/g) || []).length;

          // Guarda a posição após qualquer propriedade de signing
          if (
            trimmed.startsWith('storeFile') ||
            trimmed.startsWith('storePassword') ||
            trimmed.startsWith('keyAlias') ||
            trimmed.startsWith('keyPassword')
          ) {
            insertAt = i + 1;
          }

          if (depth <= 0) {
            // Fecha o bloco release — insere antes se não encontrou propriedade
            if (insertAt < 0) insertAt = i;
            inReleaseBlock = false;
            inSigningConfigs = false;
            break;
          }
        }
      }

      if (insertAt > 0) {
        const indent = (lines[insertAt - 1].match(/^(\s+)/) || ['', '            '])[1];
        lines.splice(insertAt, 0,
          `${indent}v1SigningEnabled true`,
          `${indent}v2SigningEnabled true`
        );
        contents = lines.join('\n');
        fs.writeFileSync(buildGradlePath, contents);
        console.log('[withV1Signing] ✅ v1SigningEnabled + v2SigningEnabled adicionados ao release signing config');
      } else {
        console.warn('[withV1Signing] ⚠️ Bloco release não encontrado — v1 signing NÃO aplicado');
      }

      return config;
    },
  ]);
};
