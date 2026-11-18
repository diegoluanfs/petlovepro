"""Render ONLY the first page of each local PDF to a small, flattened public WebP."""
import argparse
import json
from pathlib import Path
import tempfile
from io import BytesIO
import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PLAN = json.loads((ROOT / 'scripts/cover-plan.json').read_text(encoding='utf-8'))
PUBLIC = ROOT / 'public'


def generate(source, output):
    with fitz.open(source) as doc:
        if doc.needs_pass or len(doc) == 0:
            raise ValueError(f'PDF sem primeira página acessível: {source.name}')
        page = doc[0]
        scale = min(640 / page.rect.width, 900 / page.rect.height)
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        with Image.open(BytesIO(pix.tobytes('png'))) as raw:
            image = raw.convert('RGB')
        # Create a new raster without metadata, hyperlinks, layers or embedded files.
        banner = Image.new('RGB', (image.width, image.height + 27), '#321466')
        banner.paste(image, (0, 0))
        draw = ImageDraw.Draw(banner)
        draw.text((image.width / 2, image.height + 13), 'PETLOVEPRO | CAPA PROMOCIONAL', fill='white', font=ImageFont.load_default(), anchor='mm')
        banner.save(output, 'WEBP', quality=82, method=6)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'coleções')
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    if source == PUBLIC.resolve() or PUBLIC.resolve() in source.parents:
        raise SystemExit('ERRO: a pasta com PDFs deve ficar fora de public/.')
    output = PUBLIC / 'assets' / 'covers'
    if output.resolve() != output.absolute() or PUBLIC.resolve() != PUBLIC.absolute():
        raise SystemExit('ERRO: diretório público não pode ser um link simbólico.')
    paths = []
    for item in PLAN:
        p = (source / item['source']).resolve()
        if not p.is_relative_to(source) or not p.is_file():
            raise SystemExit(f"ERRO: arquivo ausente ou inválido: {item['source']}")
        paths.append((p, item['name']))
    # Validate and render the complete inventory before replacing any existing image.
    with tempfile.TemporaryDirectory(dir=ROOT) as tmp:
        temp = Path(tmp)
        for p, name in paths:
            generate(p, temp / name)
            print(f'OK {name}')
        output.mkdir(parents=True, exist_ok=True)
        for _, name in paths:
            (temp / name).replace(output / name)
    print(f'{len(paths)} capas geradas. Nenhum PDF copiado para public/.')

if __name__ == '__main__':
    main()
