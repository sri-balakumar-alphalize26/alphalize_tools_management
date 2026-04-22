"""
Standalone WhatsApp QR worker.

Runs as a separate Python subprocess (NOT inside Odoo) so neonize
has its own clean environment without Odoo's worker/threading issues.

Usage:
    python wa_qr_worker.py <db_path>

Behavior:
    - Initializes neonize NewClient with the given session DB path
    - When neonize emits a QR, saves it as a PNG next to the DB:
        <db_path>.qr.png    (the image to display)
        <db_path>.qr.ready  (marker file Odoo polls for)
    - On successful connection, writes:
        <db_path>.connected (marker file)
    - On error:
        <db_path>.error     (error message file)
    - Stays alive after connection so neonize keeps the link active.
"""
import os
import sys
import io
import time
import traceback


def main():
    if len(sys.argv) < 2:
        print("Usage: wa_qr_worker.py <db_path>", flush=True)
        sys.exit(2)

    db_path = sys.argv[1]
    print(f"[wa_qr_worker] starting | db_path={db_path}", flush=True)

    qr_png_path = db_path + ".qr.png"
    qr_ready_path = db_path + ".qr.ready"
    connected_path = db_path + ".connected"
    error_path = db_path + ".error"

    # Clean up stale marker files
    for p in (qr_png_path, qr_ready_path, connected_path, error_path):
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

    try:
        from neonize.client import NewClient
        from neonize.events import ConnectedEv
    except ImportError as e:
        msg = f"neonize not installed: {e}"
        print(f"[wa_qr_worker] FATAL: {msg}", flush=True)
        with open(error_path, "w") as f:
            f.write(msg)
        sys.exit(1)

    try:
        import segno
        qr_lib = "segno"
    except ImportError:
        try:
            import qrcode
            qr_lib = "qrcode"
        except ImportError:
            msg = "Neither segno nor qrcode installed"
            print(f"[wa_qr_worker] FATAL: {msg}", flush=True)
            with open(error_path, "w") as f:
                f.write(msg)
            sys.exit(1)

    print(f"[wa_qr_worker] qr_lib={qr_lib}", flush=True)

    # Make sure the parent directory exists
    parent_dir = os.path.dirname(db_path)
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)

    print(f"[wa_qr_worker] creating NewClient...", flush=True)
    try:
        client = NewClient(db_path)
    except Exception as e:
        msg = f"NewClient() failed: {e}"
        print(f"[wa_qr_worker] FATAL: {msg}", flush=True)
        traceback.print_exc()
        with open(error_path, "w") as f:
            f.write(msg)
        sys.exit(1)

    print(f"[wa_qr_worker] NewClient created", flush=True)

    def handle_qr(client_ref, qr_data):
        print(f"[wa_qr_worker] QR CALLBACK FIRED", flush=True)
        try:
            qr_string = qr_data.decode("utf-8") if isinstance(qr_data, bytes) else str(qr_data)
            print(f"[wa_qr_worker] qr_string len={len(qr_string)}", flush=True)

            if qr_lib == "segno":
                qr_img = segno.make(qr_string)
                qr_img.save(qr_png_path, scale=20)
            else:
                qr_obj = qrcode.QRCode(box_size=20, border=4)
                qr_obj.add_data(qr_string)
                qr_obj.make(fit=True)
                img = qr_obj.make_image(fill_color="black", back_color="white")
                img.save(qr_png_path, format="PNG")

            size = os.path.getsize(qr_png_path)
            print(f"[wa_qr_worker] saved QR PNG: {qr_png_path} ({size} bytes)", flush=True)

            # Write the ready marker LAST so the reader knows the PNG is complete
            with open(qr_ready_path, "w") as f:
                f.write(str(int(time.time())))
            print(f"[wa_qr_worker] wrote ready marker", flush=True)
        except Exception as e:
            msg = f"QR generation error: {e}"
            print(f"[wa_qr_worker] {msg}", flush=True)
            traceback.print_exc()
            with open(error_path, "w") as f:
                f.write(msg)

    client.qr(handle_qr)

    @client.event(ConnectedEv)
    def on_connected(event):
        print(f"[wa_qr_worker] CONNECTED event fired", flush=True)
        try:
            with open(connected_path, "w") as f:
                f.write(str(int(time.time())))
        except Exception as e:
            print(f"[wa_qr_worker] failed to write connected marker: {e}", flush=True)

    print(f"[wa_qr_worker] calling client.connect() ...", flush=True)
    try:
        client.connect()
        print(f"[wa_qr_worker] client.connect() returned", flush=True)
    except Exception as e:
        msg = f"client.connect() crashed: {e}"
        print(f"[wa_qr_worker] {msg}", flush=True)
        traceback.print_exc()
        with open(error_path, "w") as f:
            f.write(msg)
        sys.exit(1)

    # Stay alive so neonize keeps the WhatsApp link active
    print(f"[wa_qr_worker] entering keep-alive loop", flush=True)
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print(f"[wa_qr_worker] interrupted, exiting", flush=True)


if __name__ == "__main__":
    main()
