# V34.6.3 Smart App Identity — prepared assets, integration pending
Base: 6c02b7d072d96ae68c9dc4521e733274a2c4da16 (164 approved tests).
The manifest name is now Raytech CG, installation id remains /raytech-cg-homologacao. No production changes.
The approved artwork was cropped to the emblem (no embedded wordmark) and exported with real alpha at 192, 512, 180 and 32 px. ZIP SHA-256: aa10cc9b46b95bb9a9f885bdd12241a7e0aecba05bab5c4d0b1f6bd54372c518.
Binary transfer to this repository is pending. Do not deploy this intermediate commit as V34.6.3.
To complete: extract Raytech_CG_V34.6.3_Icones.zip, run from backend-v340/workspace-v345:
    node integrate-app-identity.mjs <absolute-path-to-extracted-directory>
The helper checks the exact hashes and PNG dimensions/alpha before copying assets, updates only installation icon links and the display version, and extends the visual test suite. Existing logo images used inside the app remain unchanged. Commit resulting source and PNGs, run CI (166 expected), deploy only an approved final artifact to homologation.
iOS and Android may apply launcher masks or backgrounds; the installed shortcut label is determined by the platform and existing installations may not refresh metadata immediately. The included ICO is optional for a manually customized Windows shortcut, not part of Hosting.
