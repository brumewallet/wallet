# Brume Wallet ☁️

The private Ethereum wallet with built-in Tor

## Usage

You can use Brume Wallet on a website, as a browser extension, and as a mobile application

### Website (official)

- [Go to wallet.brume.money](https://wallet.brume.money)

### Website (ipfs)

- [Go to latest version](https://github.com/brumewallet/wallet/blob/main/dist/.website.ipfs.md)

### Chrome-like extension (official store)

- [Chrome Store](https://chrome.google.com/webstore/detail/brume-wallet/oljgnlammonjehmmfahdjgjhjclpockd)

### Firefox-like extension (official store)

- [Firefox Store](https://addons.mozilla.org/firefox/addon/brumewallet/)

### Safari extension on iOS and macOS (official store)

- [Apple TestFlight](https://testflight.apple.com/join/WtNNiY98)

### Android application (signed .apk)

- [Download .apk](https://github.com/brumewallet/wallet/raw/main/dist/android.apk)
- [F-Droid](https://f-droid.org/packages/eth.brume.wallet/)

### Safari extension on macOS only (signed .app)

- [Download .zip](https://github.com/brumewallet/wallet/raw/main/dist/macos.zip)

### Safari extension on iOS only (alternative store)

- Copy the link to the [AltStore](https://altstore.io) source

`https://raw.githubusercontent.com/brumewallet/wallet/main/altstore.json`

### Safari extension on iOS only (signed .ipa)

- [Download .ipa](https://github.com/brumewallet/wallet/raw/main/dist/ios-and-ipados.ipa)

### Website (reproducible cloud-hosting)

- Clone the repository on your GitHub account
- Host it on a cloud provider with `npm run build:vercel` as build command and `out` as build output

### Website (reproducible self-hosting)

- [Download .zip](https://github.com/brumewallet/wallet/raw/main/dist/website.zip)
- Extract `website.zip` in a new folder
- Serve using `npx serve`

### Chrome-like extension (reproducible self-installation)

- [Download .zip](https://github.com/brumewallet/wallet/raw/main/dist/chrome.zip)
- Extract `chrome.zip` in a new folder
- Open Chrome, open settings, left panel, bottom, click `Extensions`
- Top bar, right, enable `Developer mode`
- Click `Load unpacked`, select the folder where `chrome.zip` was extracted

### Firefox-like extension (reproducible temporary self-installation)

- [Download .zip](https://github.com/brumewallet/wallet/raw/main/dist/firefox.zip)
- Extract `firefox.zip` in a new folder
- Open Firefox, navigate to `about:debugging`
- Left panel, click `This Firefox`
- `Temporary Extensions`, click `Load Temporary Add-on`
- Navigate to the Brume Wallet folder
- Open the folder where `firefox.zip` was extracted
- Select the `manifest.json` file

### [All builds (ipfs)](https://github.com/brumewallet/wallet/blob/main/dist/.ipfs.md)

## Reproducible building

### Installing and building

- Install node v20.3.1 (npm v9.6.7)

- Clone the repository

```bash
git clone https://github.com/brumewallet/wallet && cd wallet
```

- Build the website and extension

```bash
npm install && npm run build && npm run zip
```

- Website and extension files are in the `dist` folder

### Comparing released files with built files

GitHub Actions automatically rebuilds each release and checks that the committed files are the same as the built ones

https://github.com/brumewallet/wallet/actions/workflows/release.yml

You can check the comparison yourself by running the following

```bash
# Create ./tmp
mkdir ./tmp

# Unzip committed zip files into ./tmp
unzip ./dist/chrome.zip -d ./tmp/chrome
unzip ./dist/firefox.zip -d ./tmp/firefox
unzip ./dist/website.zip -d ./tmp/website

# Rebuild
npm ci && npm run build

# Compare unzipped content
diff -r ./tmp/chrome ./dist/chrome
diff -r ./tmp/firefox ./dist/firefox
diff -r ./tmp/website ./dist/website

# Delete ./tmp
rm -rf ./tmp

# Restore build files
git restore ./dist/

# Recompute IPFS hashes
node ./scripts/ipfs.mjs

# Display IPFS hashes
cat ./dist/.ipfs.md
cat ./dist/.website.ipfs.md

# Compare all files
[[ -z $(git status --porcelain) ]] && echo "OK" || echo "NOT OK"
```

## Security design

### Encrypted storage

Your storage is hashed and encrypted using strong cryptography algorithms and parameters

- Cryptography algorithms are seeded by PBKDF2 with 1M+ iterations from your password
- All storage keys are hashed using HMAC-SHA256, it is impossible to retrieve the original key
- All storage values are encrypted using AES-256-GCM, each with a different ciphertext/IV

### Authenticated storage

Some critical entities like private keys and seed phrases are stored in WebAuthn and require authentication (FaceID/TouchID)

- They are encrypted before being stored in WebAuthn storage
- Their reference ID and encryption IV are stored in encrypted storage (the one we talked above)

Nobody can access your private keys or seed phrases without your password + authentication (FaceID/TouchID)

This mitigates supply-chain attacks and phishing attacks, and prevents phone-left-on-the-table attacks

### Supply-chain hardened

We try our best to avoid supply-chain attacks from external packages

- We use browser APIs when available
- All WebAssembly packages are reproducible and try to use audited dependencies
- All JavaScript cryptography packages are from [Paul Miller](https://github.com/paulmillr) and are audited
- We count each individual maintainer in our dependency graph as a risk
- We use runtime protection techniques such as object-capability model
- We upload each release on IPFS and (soon) publish the hash on Ethereum

### Safe Tor and TLS protocols

We use the Tor and the TLS protocols in a way that's mostly safe, even though they are not fully implemented nor audited

Keep in mind that the zero risk doesn't exist, and a highly motivated attacker could deanonymize you by doing the following steps (very unlikely to happen):

1. Owning the entry node, and logging all IP addresses using Brume Wallet, something he could know by:
  - Deep packet inspection, since our Tor/TLS packets may not be like those from regular Tor/TLS users
  - Behaviour analysis, since our Tor/TLS may not behave the same way as regular Tor/TLS implementations

2. Owning the JSON-RPC server, and logging all wallet addresses that used Tor

3. Correlating IP addresses logs with wallet addresses logs, and if both sides are small enough, linking a particular IP address to a particular wallet address
