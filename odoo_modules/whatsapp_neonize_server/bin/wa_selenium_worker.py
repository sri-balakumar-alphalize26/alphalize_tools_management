"""
WhatsApp QR worker using Selenium + WhatsApp Web.

Bypasses neonize entirely. Uses a real headless Chrome browser to load
web.whatsapp.com, captures the QR canvas element as a PNG, then waits
for the user to scan.

Usage:
    python wa_selenium_worker.py <db_path>

Marker files written (same protocol as wa_qr_worker.py):
    <db_path>.qr.png    - the QR PNG for Odoo to display
    <db_path>.qr.ready  - marker indicating QR is saved
    <db_path>.connected - marker indicating user scanned successfully
    <db_path>.error     - error message if something went wrong
"""
import os
import sys
import time
import traceback


def log(msg):
    print(f"[wa_selenium] {msg}", flush=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: wa_selenium_worker.py <db_path>", flush=True)
        sys.exit(2)

    db_path = sys.argv[1]
    log(f"starting | db_path={db_path}")

    qr_png_path = db_path + ".qr.png"
    qr_ready_path = db_path + ".qr.ready"
    connected_path = db_path + ".connected"
    error_path = db_path + ".error"
    profile_dir = db_path + ".chromeprofile"

    # Clean stale markers (but keep the chromeprofile so session persists)
    for p in (qr_png_path, qr_ready_path, connected_path, error_path):
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

    # Ensure parent dir exists
    parent_dir = os.path.dirname(db_path)
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)

    if not os.path.exists(profile_dir):
        os.makedirs(profile_dir, exist_ok=True)

    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.common.exceptions import TimeoutException, NoSuchElementException
    except ImportError as e:
        msg = f"selenium not installed: {e}"
        log(f"FATAL: {msg}")
        with open(error_path, "w") as f:
            f.write(msg)
        sys.exit(1)

    log("selenium imported")

    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1280,900")
    chrome_options.add_argument(f"--user-data-dir={profile_dir}")
    chrome_options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    log("launching Chrome...")
    try:
        driver = webdriver.Chrome(options=chrome_options)
    except Exception as e:
        msg = (
            f"Failed to launch Chrome: {e}\n\n"
            "Make sure Google Chrome is installed. "
            "Selenium Manager will auto-download chromedriver on first run, "
            "but needs internet access."
        )
        log(f"FATAL: {msg}")
        traceback.print_exc()
        with open(error_path, "w") as f:
            f.write(msg)
        sys.exit(1)

    log("Chrome launched")

    try:
        driver.get("https://web.whatsapp.com/")
        log("navigated to web.whatsapp.com")

        # Wait for one of these to appear:
        #  - QR canvas → need to scan
        #  - Chat list → already logged in (from persisted profile)
        wait = WebDriverWait(driver, 60)

        log("waiting for QR canvas or logged-in state...")

        def either_qr_or_chats(drv):
            # Try to find QR canvas (various selectors WhatsApp Web uses)
            try:
                canvases = drv.find_elements(By.CSS_SELECTOR, "canvas")
                for c in canvases:
                    try:
                        aria = c.get_attribute("aria-label") or ""
                        if "scan" in aria.lower() or "qr" in aria.lower():
                            return ("qr", c)
                    except Exception:
                        continue
                # Fallback: any canvas inside div[data-ref] (old layout)
                data_ref_divs = drv.find_elements(By.CSS_SELECTOR, "div[data-ref] canvas")
                if data_ref_divs:
                    return ("qr", data_ref_divs[0])
                # Another fallback: canvas with size ~264 (QR default)
                for c in canvases:
                    try:
                        w = c.get_attribute("width")
                        if w and int(w) >= 200:
                            return ("qr", c)
                    except Exception:
                        continue
            except Exception:
                pass

            # Check for logged-in markers (chat list / side pane)
            try:
                if drv.find_elements(By.CSS_SELECTOR, "div#pane-side"):
                    return ("connected", None)
                if drv.find_elements(By.CSS_SELECTOR, "div[aria-label='Chat list']"):
                    return ("connected", None)
            except Exception:
                pass

            return None

        state = None
        start = time.time()
        while time.time() - start < 60:
            state = either_qr_or_chats(driver)
            if state:
                break
            time.sleep(0.5)

        if not state:
            msg = "Timed out waiting for WhatsApp Web to load QR or chat list"
            log(msg)
            # Save whole page screenshot for debug
            try:
                driver.save_screenshot(db_path + ".debug.png")
            except Exception:
                pass
            with open(error_path, "w") as f:
                f.write(msg)
            driver.quit()
            sys.exit(1)

        kind, element = state

        if kind == "connected":
            log("already logged in — no QR needed")
            with open(connected_path, "w") as f:
                f.write(str(int(time.time())))
            # Stay alive to keep the session
            log("entering keep-alive loop")
            try:
                while True:
                    time.sleep(60)
            except KeyboardInterrupt:
                pass
            driver.quit()
            return

        # kind == "qr"
        log("QR canvas found — saving screenshot")

        try:
            # Screenshot just the QR element
            png_bytes = element.screenshot_as_png
            with open(qr_png_path, "wb") as f:
                f.write(png_bytes)
            log(f"saved QR PNG: {qr_png_path} ({len(png_bytes)} bytes)")
        except Exception as e:
            # Fall back to full page screenshot
            log(f"element screenshot failed ({e}), using full page")
            driver.save_screenshot(qr_png_path)

        # Write ready marker LAST
        with open(qr_ready_path, "w") as f:
            f.write(str(int(time.time())))
        log("wrote qr.ready marker")

        # Now wait for the user to scan (QR canvas disappears / chat list appears)
        log("waiting for user to scan (max 120s)...")
        scan_start = time.time()
        while time.time() - scan_start < 120:
            try:
                if driver.find_elements(By.CSS_SELECTOR, "div#pane-side") or \
                   driver.find_elements(By.CSS_SELECTOR, "div[aria-label='Chat list']"):
                    log("CONNECTED — user scanned the QR")
                    with open(connected_path, "w") as f:
                        f.write(str(int(time.time())))
                    break
            except Exception:
                pass
            time.sleep(1)
        else:
            log("scan timeout — user did not scan in 120s, QR may be stale")

        # Keep alive so the browser session stays open
        log("entering keep-alive loop")
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            log("interrupted, exiting")

    except Exception as e:
        msg = f"Worker crashed: {e}"
        log(msg)
        traceback.print_exc()
        try:
            with open(error_path, "w") as f:
                f.write(msg + "\n\n" + traceback.format_exc())
        except Exception:
            pass
        try:
            driver.save_screenshot(db_path + ".crash.png")
        except Exception:
            pass
        sys.exit(1)
    finally:
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == "__main__":
    main()
