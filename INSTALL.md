# How to Install "Requests and Offers"

All releases are available on GitHub: **https://github.com/happenings-community/requests-and-offers/releases/latest**

---

## What Type of Computer Do You Have?

- **Windows** — you see a Start menu and taskbar at the bottom
- **Mac** — you see a dock and an Apple logo in the top-left corner
- **Linux** — you're probably already tech-savvy, but we've got you covered too

---

## Mac Users — Two Options

### Option A: Homebrew (Recommended)

Homebrew is a free tool that makes installing apps on Mac much easier — think of it as an app store for your terminal.

**Step 1: Install Homebrew (one-time setup)**

Open Terminal (press `Cmd + Space`, type "Terminal", press Enter), then paste this and press Enter:

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

You may need to enter your password. Wait for it to finish — this can take a few minutes.

**Step 2: Add the Requests and Offers repository**

```
brew tap happenings-community/requests-and-offers
```

**Step 3: Install the app**

```
brew install --cask happenings-community/requests-and-offers/requests-and-offers
```

The full name matters. Newer versions of Homebrew only install apps from outside their own collection when you name the source like this, which also tells Homebrew you trust it.

> **Installed from a DMG before?** Quit the app, then run the same command with `--force` added after `--cask`, so Homebrew can replace the existing app.

**Step 4: Launch the app**

Either search for "Requests and Offers" using Spotlight (`Cmd + Space`), or run:

```
open -a "Requests and Offers"
```

**Updating later**

```
brew upgrade --cask requests-and-offers
```

**Uninstalling**

```
brew uninstall --cask requests-and-offers
```

---

### Option B: Direct Download for Mac

**Step 1: Find out which Mac you have**

Click the Apple logo (top-left) → "About This Mac" → look at the chip/processor:
- **Apple Silicon** — shows M1, M2, M3, or similar
- **Intel** — shows Intel processor

**Step 2: Download the right version**

Go to the [latest release page](https://github.com/happenings-community/requests-and-offers/releases/latest), scroll to the Desktop Apps section in the release notes, and click the link for your Mac type. The file will be named something like:
- **Apple Silicon (M1/M2/M3):** `requests-and-offers....-arm64.dmg`
- **Intel Mac:** `requests-and-offers...-x64.dmg`

**Step 3: Install**

1. Open the downloaded `.dmg` file from your Downloads folder
2. Drag "Requests and Offers" into the Applications folder
3. Eject the disk image (click the eject icon in Finder)

**Step 4: Launch**

Open Finder → Applications → double-click "Requests and Offers"

> **Security warning?** If macOS blocks the app, go to System Settings → Privacy & Security → scroll down and click "Open Anyway"

---

## Windows Users

**Step 1: Download**

Go to the [latest release page](https://github.com/happenings-community/requests-and-offers/releases/latest), scroll to the Desktop Apps section in the release notes, and click the Windows download link. The file will be named something like `requests-and-offers...-setup.exe`.

**Step 2: Install**

1. Go to your Downloads folder
2. Right-click the `.exe` file and select "Run as administrator"
3. If Windows asks "Do you want to allow this app to make changes?", click "Yes"
4. Follow the installation wizard and click "Finish"

**Step 3: Launch**

Find "Requests and Offers" in your Start menu or on your Desktop.

> **Windows Defender warning?** Click "More info" then "Run anyway"

---

## Linux Users

### Option A: AppImage (works on most distributions)

1. Go to the [latest release page](https://github.com/happenings-community/requests-and-offers/releases/latest), scroll to the Desktop Apps section in the release notes, and click the Linux (Universal) download link. The file will be named something like `requests-and-offers...AppImage`
2. Make it executable — either right-click → Properties → tick "Executable", or run:

```
chmod +x requests-and-offers*.AppImage
```

3. Double-click to run, or from terminal: `./requests-and-offers*.AppImage`

> If you renamed the file when downloading, replace `requests-and-offers*.AppImage` with whatever you called it.

### Option B: Debian/Ubuntu (.deb)

1. Go to the [latest release page](https://github.com/happenings-community/requests-and-offers/releases/latest), scroll to the Desktop Apps section in the release notes, and click the Linux (Debian/Ubuntu) download link. The file will be named something like `requests-and-offers..._amd64.deb`
2. Install via terminal:

```
sudo dpkg -i requests-and-offers*.deb
```

If you see dependency errors, follow up with:

```
sudo apt-get install -f
```

> If you renamed the file when downloading, replace `requests-and-offers*.deb` with whatever you called it.

3. Launch from your applications menu or by running `requests-and-offers` in terminal

---

## Troubleshooting

**"App can't be opened because it's from an unidentified developer" (Mac)**
Go to System Settings → Privacy & Security → click "Open Anyway"

**Windows Defender blocks installation**
Click "More info" → "Run anyway"

**App won't start**
Try restarting your computer, check you have enough disk space, and make sure your OS is up to date

**"Refusing to load cask ... from untrusted tap" (Mac, Homebrew)**
Install using the full name shown in Option A, Step 3

**"It seems there is already an App at '/Applications/Requests and Offers.app'" (Mac, Homebrew)**
Quit the app, then run the install command again with `--force` added after `--cask`

**Download is slow or fails**
Try a different browser, disable VPN if you're using one, or check your internet connection

---

## Getting Help

If you run into problems, check the [GitHub issues page](https://github.com/happenings-community/requests-and-offers/issues) for known issues or to report a new one.
