# Implementation Plan - Firebase CI/CD

Ref: `web-viewer` project deployment.

## User Review Required
- **Secrets**: You will need to add `FIREBASE_TOKEN` to your GitHub Repository Secrets. I will provide instructions on how to generate this.
- **Branch**: The workflow will trigger on push to `main`. Please confirm if this is the desired branch.

## Proposed Changes

### GitHub Workflows

#### [NEW] [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
- **Trigger**: Push to `main` branch.
- **Jobs**:
    - `build_and_deploy`:
        - Checkout code.
        - Setup Node.js.
        - Install dependencies (`npm ci`).
        - **[NEW] Generate Static Configs (`npm run generate:static`)**.
        - Build project (`npm run build`).
        - Deploy to Firebase (`firebase deploy --only hosting`).
- **Env Vars**:
    - `FIREBASE_TOKEN`: Used for authentication.

## Verification Plan

### Manual Verification
- Commit and push the workflow file.
- Observe the GitHub Actions tab for proper execution.
- Verify the site is updated on the Firebase Hosting URL.

### Firebase Token
1. Go to your GitHub repository settings -> Secrets and variables -> Actions.
1. Create a new repository secret named FIREBASE_TOKEN.
1. Paste your Firebase CLI token. (Run `firebase login:ci` locally to generate one if needed).