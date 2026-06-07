// @ts-nocheck
const fs = require('fs');
const path = require('path');

console.log("Generating SDK... (Stub). To fully implement, we need an OpenAPI spec and @openapitools/openapi-generator-cli. Outputting dummy C# file to apps/client/sdk/PartyGame.cs");

const clientSdkDir = path.resolve(__dirname, '../../client/sdk');

if (!fs.existsSync(clientSdkDir)) {
  fs.mkdirSync(clientSdkDir, { recursive: true });
}

const csFile = path.join(clientSdkDir, 'PartyGame.cs');
const dummyContent = `// Dummy C# SDK for PartyGame
namespace PartyGame.Sdk {
    public class PartyGameClient {
        // TODO: Auto-generated from OpenAPI
    }
}
`;

fs.writeFileSync(csFile, dummyContent, 'utf-8');
console.log("Done.");
