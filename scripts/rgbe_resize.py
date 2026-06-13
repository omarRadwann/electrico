"""Downsample a Radiance .hdr (RGBE) with numpy only — no imageio/cv2.
Reads new-RLE scanlines, decodes to float RGB (linear), block-averages, re-encodes
to FLAT RGBE (valid; three's RGBELoader reads it). Writes a NEW file so the
original is preserved until the result is verified in-browser.

Usage: python scripts/rgbe_resize.py in.hdr out.hdr <factor>
"""
import sys, struct, numpy as np

def read_hdr(path):
    with open(path, "rb") as f:
        data = f.read()
    # header: ascii lines until a blank line, then the resolution line
    i = 0
    # find resolution line "-Y H +X W\n"
    # parse header text up to the dimensions line
    # header ends at first line starting with -Y/+Y
    nl = 0
    res = None
    pos = 0
    while True:
        j = data.index(b"\n", pos)
        line = data[pos:j].decode("latin-1").strip()
        pos = j + 1
        if line.startswith("-Y") or line.startswith("+Y"):
            res = line
            break
    parts = res.split()
    H = int(parts[1]); W = int(parts[3])
    # binary scanlines start at pos
    rgbe = np.zeros((H, W, 4), dtype=np.uint8)
    p = pos
    for y in range(H):
        # new-RLE header: 2,2, W>>8, W&0xff
        h0, h1, h2, h3 = data[p], data[p+1], data[p+2], data[p+3]
        p += 4
        if not (h0 == 2 and h1 == 2 and ((h2 << 8) | h3) == W):
            raise SystemExit(f"scanline {y}: not new-RLE (got {h0},{h1},{h2},{h3}) — flat fallback not implemented")
        for ch in range(4):
            x = 0
            while x < W:
                count = data[p]; p += 1
                if count > 128:
                    run = count - 128
                    val = data[p]; p += 1
                    rgbe[y, x:x+run, ch] = val
                    x += run
                else:
                    for k in range(count):
                        rgbe[y, x+k, ch] = data[p+k]
                    p += count
                    x += count
    return H, W, rgbe

def rgbe_to_float(rgbe):
    e = rgbe[..., 3].astype(np.int32)
    scale = np.where(e > 0, np.exp2(e - (128 + 8)), 0.0).astype(np.float32)
    rgb = rgbe[..., :3].astype(np.float32) * scale[..., None]
    return rgb

def float_to_rgbe(rgb):
    H, W, _ = rgb.shape
    out = np.zeros((H, W, 4), dtype=np.uint8)
    mx = rgb.max(axis=2)
    nz = mx > 1e-32
    e = np.zeros((H, W), dtype=np.int32)
    frac, exp = np.frexp(np.where(nz, mx, 1.0))  # mx = frac*2^exp, frac in [0.5,1)
    mant = frac * 256.0 / np.where(nz, mx, 1.0)  # = 256*2^(exp)/... simplify below
    # standard: rgbe = rgb * (256 / mx) * 2^(-exp) ; E = exp + 128
    s = np.where(nz, (frac * 256.0) / np.where(nz, mx, 1.0), 0.0)
    out[..., 0] = np.clip(rgb[..., 0] * s, 0, 255).astype(np.uint8)
    out[..., 1] = np.clip(rgb[..., 1] * s, 0, 255).astype(np.uint8)
    out[..., 2] = np.clip(rgb[..., 2] * s, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(nz, exp + 128, 0).astype(np.uint8)
    return out

def write_flat_hdr(path, rgbe):
    H, W, _ = rgbe.shape
    with open(path, "wb") as f:
        f.write(b"#?RADIANCE\n")
        f.write(b"FORMAT=32-bit_rle_rgbe\n\n")
        f.write(f"-Y {H} +X {W}\n".encode("ascii"))
        f.write(rgbe.astype(np.uint8).tobytes())  # flat RGBE, row-major

if __name__ == "__main__":
    src, dst, factor = sys.argv[1], sys.argv[2], int(sys.argv[3])
    H, W, rgbe = read_hdr(src)
    rgb = rgbe_to_float(rgbe)
    nh, nw = H // factor, W // factor
    # block-average in linear light
    rgb = rgb[: nh * factor, : nw * factor].reshape(nh, factor, nw, factor, 3).mean(axis=(1, 3))
    out = float_to_rgbe(rgb.astype(np.float32))
    write_flat_hdr(dst, out)
    import os
    print(f"{src} ({W}x{H}, {os.path.getsize(src)} B) -> {dst} ({nw}x{nh}, {os.path.getsize(dst)} B)")
