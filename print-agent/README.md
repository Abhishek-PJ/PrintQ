# PrintQ — Local Print Agent

The print agent runs **on the shop computer** (the PC that is connected to the printer).  
It receives print jobs from the PrintQ server over the internet and sends them directly to your printer — no manual downloading required.

---

## What You Need

| Requirement | Notes |
|---|---|
| Windows 10 / 11 (or Linux) | Windows is recommended |
| Node.js 18 or newer | [Download here](https://nodejs.org) — choose the **LTS** version |
| SumatraPDF (Windows only) | [Download here](https://www.sumatrapdfreader.org/download-free-pdf-viewer) |
| LibreOffice (optional) | Only needed if customers upload `.docx` / `.doc` files. [Download here](https://www.libreoffice.org/download/download-libreoffice/) |
| Internet connection | The shop PC must be able to reach your PrintQ server |

---

## Step 1 — Install Node.js

1. Open the link above and download the **LTS** installer.
2. Run the installer — click **Next** all the way through, leave all defaults as-is.
3. When it finishes, open **Command Prompt** and type:
   ```
   node --version
   ```
   You should see something like `v20.11.0`. If you do, Node.js is installed correctly.

---

## Step 2 — Install SumatraPDF

1. Download **SumatraPDF** from the link above and install it.
2. The default install path is:
   ```
   C:\Program Files\SumatraPDF\SumatraPDF.exe
   ```
   If you installed it somewhere else, note the path — you will need it later.

---

## Step 3 — Download the Print Agent

Ask your PrintQ administrator for the `print-agent` folder, or copy it from the server.  
Place it anywhere on the shop PC, for example:
```
C:\PrintQ\print-agent\
```

---

## Step 4 — Create the Configuration File

Inside the `print-agent` folder, create a new file called **`.env`**  
(note the dot at the start of the name).

Open it with Notepad and paste the following, filling in your details:

```env
# Address of your PrintQ server
SERVER_URL=https://your-printq-server.com

# Secret key — get this from your PrintQ administrator
AGENT_SECRET=paste_your_secret_key_here

# Your shop ID — get this from your PrintQ administrator
SHOP_ID=paste_your_shop_id_here

# Name of the printer exactly as Windows shows it
# Run:  wmic printer get name
# in Command Prompt to see the list
PRINTER_NAME=HP LaserJet Pro M404dn

# (Optional) If SumatraPDF is NOT in the default location, set the full path:
# SUMATRA_PATH=C:\Program Files\SumatraPDF\SumatraPDF.exe

# (Optional) If LibreOffice is NOT on the system PATH, set the full path to soffice:
# LIBREOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe
```

> **How to find your printer name exactly:**  
> Open Command Prompt and run:  
> ```
> wmic printer get name
> ```
> Copy the name **exactly** as it appears (including spaces) into `PRINTER_NAME`.

---

## Step 5 — Install Dependencies

Open **Command Prompt**, navigate to the print-agent folder, and run:

```
cd C:\PrintQ\print-agent
npm install
```

This downloads the required packages. It only needs to be done once.

---

## Step 6 — Build the Agent

```
npm run build
```

This compiles the code. You only need to do this again if the agent is updated.

---

## Step 7 — Start the Agent

```
npm start
```

If everything is set up correctly you will see:

```
PrintQ Local Print Agent
  Server : https://your-printq-server.com
  Shop   : your-shop-id

✅  Connected to PrintQ server
🖨️   Printers: HP LaserJet Pro M404dn
     HP LaserJet Pro M404dn: color=false, duplex=true
🏪  Shop registered: your-shop-id
```

The agent is now running and ready to receive print jobs.

---

## Step 8 — Run the Agent Automatically on Startup (Recommended)

You don't want to manually start the agent every time the PC restarts.

### Option A — Windows Task Scheduler (simplest)

1. Press **Win + R**, type `taskschd.msc`, press Enter.
2. Click **Create Basic Task** on the right.
3. Name it `PrintQ Agent`, click Next.
4. Trigger: **When the computer starts**, click Next.
5. Action: **Start a program**, click Next.
6. Program: `node`  
   Arguments: `C:\PrintQ\print-agent\dist\agent.js`  
   Start in: `C:\PrintQ\print-agent`
7. Finish. Check **"Run whether user is logged on or not"** in Properties.

### Option B — NSSM (run as a Windows Service)

1. Download **NSSM** from [nssm.cc](https://nssm.cc/download).
2. Open Command Prompt as Administrator and run:
   ```
   nssm install PrintQAgent
   ```
3. In the dialog:
   - **Path**: `C:\Program Files\nodejs\node.exe`
   - **Startup directory**: `C:\PrintQ\print-agent`
   - **Arguments**: `dist\agent.js`
4. Click **Install service**.
5. Start the service:
   ```
   nssm start PrintQAgent
   ```

---

## Checking the Agent Status

In the PrintQ **Admin Dashboard → Queue** page, the top of the page shows:

- 🟢 **Print Agent Online** — the agent is connected and ready
- 🔴 **Print Agent Offline** — check that the agent is running on the shop PC

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `AGENT_SECRET and SHOP_ID must be set` | Check your `.env` file — both values must be filled in |
| `Connection error: xhr poll error` | The PC cannot reach the server — check internet connection and `SERVER_URL` |
| `SumatraPDF print failed` | Make sure SumatraPDF is installed; if it's in a custom location set `SUMATRA_PATH` in `.env` |
| `LibreOffice failed` | Make sure LibreOffice is installed; if it's in a custom location set `LIBREOFFICE_PATH` in `.env` |
| Printer not found | Run `wmic printer get name` in Command Prompt and copy the name exactly into `PRINTER_NAME` |
| Nothing prints but no error shown | Check the Windows print queue (open **Printers & Scanners**, click your printer, click **Open queue**) |

---

## Updating the Agent

When you receive an updated version of the agent:

1. Stop the agent (or the service/task).
2. Replace the `print-agent` folder contents with the new files.
3. Run `npm install` again (in case dependencies changed).
4. Run `npm run build`.
5. Start the agent again.

Your `.env` file is not touched during updates — you don't need to reconfigure it.

---

## Security Notes

- Keep your `.env` file private — never share it or commit it to Git.
- The `AGENT_SECRET` key ties this agent to your shop only — jobs from other shops cannot be sent to your printer.
- The agent connects **outbound** to the server — no inbound ports need to be opened on your router.
