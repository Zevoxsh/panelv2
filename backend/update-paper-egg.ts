import { db } from './src/db/index.js'
import { eggs, eggVariables } from './src/db/schema.js'
import { eq } from 'drizzle-orm'

const PAPER_EGG_ID = '3a9146da-1bc0-44d8-bf9e-a40b564283e1'

const installScript = `#!/bin/bash
cd /mnt/server

MC_VERSION=\${MINECRAFT_VERSION:-1.21.4}
JAR_FILE=\${SERVER_JARFILE:-server.jar}

if [ "\${MC_VERSION}" = "latest" ]; then
  MC_VERSION=$(curl -sSL https://api.papermc.io/v2/projects/paper | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['versions'][-1])")
fi

BUILD=$(curl -sSL "https://api.papermc.io/v2/projects/paper/versions/\${MC_VERSION}/builds" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['builds'][-1]['build'])")

if [ -z "$BUILD" ]; then
  echo "Could not find Paper build for $MC_VERSION"
  exit 1
fi

echo "Downloading Paper \${MC_VERSION} build \${BUILD}..."
curl -sSLo "\${JAR_FILE}" "https://api.papermc.io/v2/projects/paper/versions/\${MC_VERSION}/builds/\${BUILD}/downloads/paper-\${MC_VERSION}-\${BUILD}.jar"
echo "Done."
`

await db.update(eggs)
  .set({
    installScript,
    installContainer: 'ghcr.io/pterodactyl/installers:alpine',
    installEntrypoint: 'ash',
    updatedAt: new Date(),
  })
  .where(eq(eggs.id, PAPER_EGG_ID))

const vars = await db.select().from(eggVariables).where(eq(eggVariables.eggId, PAPER_EGG_ID))
console.log('Existing egg variables:', vars.map(v => ({ env: v.envVariable, default: v.defaultValue })))
console.log('Install script updated successfully. Length:', installScript.length)
process.exit(0)
