"""Import only allowlisted public imagery from the structured editorial archive.
Never traverse or copy editorial documents. Re-encode pixels to WebP (no metadata).
"""
import argparse
import json
import tempfile
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PLAN = json.loads((ROOT / 'scripts/cover-plan.json').read_text(encoding='utf-8'))
PUBLIC = ROOT / 'public'


def render(source, output, kind):
    with Image.open(source) as raw:
        expected = 'WEBP' if source.suffix == '.webp' else 'JPEG'
        if raw.format != expected or getattr(raw, 'n_frames', 1) != 1:
            raise ValueError(f'Formato incorreto ou imagem animada: {source.name}')
        if raw.width * raw.height > 30_000_000:
            raise ValueError(f'Imagem grande demais: {source.name}')
        limit = (640, 900) if kind == 'cover' else (1200, 1200)
        img = ImageOps.exif_transpose(raw).convert('RGB')
        img.thumbnail(limit, Image.Resampling.LANCZOS)
        # New raster, no EXIF, embedded content or trailing bytes from the source.
        flat = Image.new('RGB', img.size)
        flat.paste(img)
        flat.save(output, 'WEBP', quality=84, method=4)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'coleções')
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    public = PUBLIC.resolve(strict=True)
    if public == source or public in source.parents or source in public.parents:
        raise SystemExit('ERRO: o acervo deve ser separado de public/.')
    output = PUBLIC / 'assets' / 'covers'
    for folder in [PUBLIC, PUBLIC / 'assets', output]:
        if folder.is_symlink() or folder.resolve() != folder.absolute():
            raise SystemExit('ERRO: caminho público não pode conter links.')
    paths = []
    for item in PLAN:
        p = source / item['source']
        if p.resolve() != p.absolute() or not p.is_file():
            raise SystemExit(f"ERRO: imagem ausente ou link não permitido: {item['source']}")
        paths.append((p, item['name'], item['kind']))
    # All files validated and encoded before publishing any replacement.
    with tempfile.TemporaryDirectory(dir=ROOT) as tmp:
        temp = Path(tmp)
        for p, name, kind in paths:
            render(p, temp / name, kind)
            print(f'OK {name}')
        output.mkdir(parents=True, exist_ok=True)
        for _, name, _ in paths:
            (temp / name).replace(output / name)
    print(f'{len(paths)} imagens promocionais geradas. Nenhum livro ou documento copiado.')

if __name__ == '__main__':
    main()
